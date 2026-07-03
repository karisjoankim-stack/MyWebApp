#!/usr/bin/env python3
import os
import sys
import json
import argparse
import pandas as pd
import numpy as np

def detect_delimiter(filepath):
    """Detect delimiter of a CSV/TSV file by checking the first line."""
    try:
        with open(filepath, 'r') as f:
            first_line = f.readline()
        if '\t' in first_line:
            return '\t'
        elif ';' in first_line:
            return ';'
        return ','
    except Exception:
        return ','

def run_map(args):
    """STEP 2: Map raw ICD billing codes into structured Phecodes."""
    run_dir = args.run_dir
    phecode_version = args.phecode_version
    icd_version = args.icd_version
    
    raw_phenotype_path = os.path.join(run_dir, 'phenotype.csv')
    if not os.path.exists(raw_phenotype_path):
        # Check TSV alternative
        if os.path.exists(os.path.join(run_dir, 'phenotype.tsv')):
            raw_phenotype_path = os.path.join(run_dir, 'phenotype.tsv')
        else:
            raise FileNotFoundError("Raw phenotype file not found in run directory.")
            
    sep = detect_delimiter(raw_phenotype_path)
    df = pd.read_csv(raw_phenotype_path, sep=sep)
    
    # 1. Rename columns to standardized names: person_id, ICD, vocabulary_id, date
    id_col = args.id_col or 'person_id'
    icd_col = args.icd_col or 'ICD'
    vocab_col = args.vocab_col or 'vocabulary_id'
    date_col = getattr(args, 'date_col', 'date')
    
    # Validation check
    if id_col not in df.columns:
        raise KeyError(f"Patient ID column '{id_col}' not found in phenotype file. Columns are: {list(df.columns)}")
    if icd_col not in df.columns:
        raise KeyError(f"ICD Code column '{icd_col}' not found in phenotype file. Columns are: {list(df.columns)}")
        
    rename_dict = {id_col: 'person_id', icd_col: 'ICD'}
    if vocab_col in df.columns:
        rename_dict[vocab_col] = 'vocabulary_id'
    if date_col in df.columns:
        rename_dict[date_col] = 'date'
        
    df = df.rename(columns=rename_dict)
    
    # Standardize data types
    df['person_id'] = df['person_id'].astype(str)
    df['ICD'] = df['ICD'].astype(str).str.strip()
    
    # Handle vocabulary_id
    if 'vocabulary_id' not in df.columns:
        # Default vocabulary: ICD9CM for version 1.2, ICD10CM for version X
        default_vocab = 'ICD9CM' if phecode_version == '1.2' else 'ICD10CM'
        df['vocabulary_id'] = default_vocab
    else:
        df['vocabulary_id'] = df['vocabulary_id'].astype(str).str.strip()
        
    # Handle date
    if 'date' not in df.columns:
        df['date'] = '2020-01-01'
    else:
        df['date'] = df['date'].astype(str).str.strip()
        
    # Write standardized phenotype file
    standardized_phenotype_path = os.path.join(run_dir, 'standardized_phenotype.csv')
    df[['person_id', 'date', 'ICD', 'vocabulary_id']].to_csv(standardized_phenotype_path, index=False)
    
    # 2. Invoke PheTK Phecode mapping
    from phetk.phecode import Phecode
    phecode_obj = Phecode(platform="custom", icd_file_path=standardized_phenotype_path)
    
    counts_output_path = os.path.join(run_dir, 'phecode_counts.tsv')
    
    phecode_obj.count_phecode(
        phecode_version=phecode_version,
        icd_version=icd_version,
        output_file_path=counts_output_path
    )
    
    # Calculate mapping summary
    if os.path.exists(counts_output_path):
        mapped_df = pd.read_csv(counts_output_path, sep='\t')
        summary = {
            "status": "success",
            "unique_participants": int(mapped_df['person_id'].nunique()),
            "unique_phecodes": int(mapped_df['phecode'].nunique()),
            "total_records": int(len(mapped_df)),
            "top_phecodes": mapped_df.groupby('phecode')['count'].sum().sort_values(ascending=False).head(10).to_dict()
        }
        print(json.dumps(summary))
    else:
        raise RuntimeError("PheWAS mapping completed but phecode_counts.tsv was not generated.")


def run_stats(args):
    """STEP 3: Run association regressions (PheWAS)."""
    run_dir = args.run_dir
    phecode_version = args.phecode_version
    icd_version = args.icd_version
    independent_var = args.independent_var
    covariates_list = [c.strip() for c in args.covariates.split(',') if c.strip()] if args.covariates else []
    sex_col = args.sex_col
    male_as_one = args.male_as_one.lower() == 'true'
    min_cases = int(args.min_cases)
    min_phecode_count = int(args.min_phecode_count)
    
    raw_genotype_path = os.path.join(run_dir, 'genotype.csv')
    if not os.path.exists(raw_genotype_path):
        # Check TSV alternative
        if os.path.exists(os.path.join(run_dir, 'genotype.tsv')):
            raw_genotype_path = os.path.join(run_dir, 'genotype.tsv')
        else:
            raise FileNotFoundError("Raw genotype/cohort file not found in run directory.")
            
    sep = detect_delimiter(raw_genotype_path)
    df = pd.read_csv(raw_genotype_path, sep=sep)
    
    # 1. Standardize participant ID column
    cohort_id_col = args.cohort_id_col or args.id_col or 'person_id'
    if cohort_id_col not in df.columns:
        # Fallback to check if person_id or sample_id exists
        if 'person_id' in df.columns:
            cohort_id_col = 'person_id'
        elif 'sample_id' in df.columns:
            cohort_id_col = 'sample_id'
        else:
            raise KeyError(f"Cohort ID column '{cohort_id_col}' not found in genotype file. Columns are: {list(df.columns)}")
            
    df = df.rename(columns={cohort_id_col: 'person_id'})
    df['person_id'] = df['person_id'].astype(str)
    
    # Validate statistical parameters
    if independent_var not in df.columns:
        raise KeyError(f"Independent variable column '{independent_var}' not found in genotype file.")
    for cov in covariates_list:
        if cov not in df.columns:
            raise KeyError(f"Covariate column '{cov}' not found in genotype file.")
            
    # Handle sex encoding if sex is a covariate or restricted
    if sex_col and sex_col in df.columns:
        # Ensure sex_col values are numeric (0/1). Standardize strings like Male/Female if needed.
        unique_vals = df[sex_col].dropna().unique()
        is_string = any(isinstance(v, str) for v in unique_vals)
        if is_string:
            def map_sex(val):
                if pd.isna(val):
                    return val
                s = str(val).strip().lower()
                if s in ['m', 'male', '1', '1.0']:
                    return 1 if male_as_one else 0
                elif s in ['f', 'female', '0', '0.0']:
                    return 0 if male_as_one else 1
                return val
            df[sex_col] = df[sex_col].map(map_sex)
            
        # Ensure it is renamed/aligned if needed, or matches the covariate list
        if sex_col != 'sex' and sex_col in covariates_list:
            df = df.rename(columns={sex_col: 'sex'})
            covariates_list = ['sex' if c == sex_col else c for c in covariates_list]
            if independent_var == sex_col:
                independent_var = 'sex'
            sex_col = 'sex'
            
    # Drop rows with null values in independent variable, covariates, or person_id
    required_cols = ['person_id', independent_var] + covariates_list
    df = df.dropna(subset=required_cols)
    
    # Save standardized genotype file
    standardized_genotype_path = os.path.join(run_dir, 'standardized_genotype.csv')
    df.to_csv(standardized_genotype_path, index=False)
    
    # 2. Invoke PheWAS regression
    from phetk.phewas import PheWAS
    
    counts_path = os.path.join(run_dir, 'phecode_counts.tsv')
    results_path = os.path.join(run_dir, 'results.tsv')
    
    if not os.path.exists(counts_path):
        raise FileNotFoundError(f"Phecode counts file not found at {counts_path}. Run Step 2 (Mapping) first.")
        
    phewas = PheWAS(
        phecode_version=phecode_version,
        phecode_count_file_path=counts_path,
        cohort_file_path=standardized_genotype_path,
        covariate_cols=covariates_list,
        independent_variable_of_interest=independent_var,
        sex_at_birth_col=sex_col or 'sex',
        male_as_one=male_as_one,
        min_cases=min_cases,
        min_phecode_count=min_phecode_count,
        icd_version=icd_version,
        output_file_path=results_path,
        verbose=False,
        suppress_warnings=True
    )
    
    res = phewas.run()
    if res:
        # Error occurred
        raise RuntimeError(f"PheWAS execution error: {res}")
        
    # Read results file and construct JSON response
    if os.path.exists(results_path):
        results_df = pd.read_csv(results_path, sep='\t')
        
        # Sort by p-value
        results_df = results_df.sort_values(by='p_value')
        
        # Parse top 100 rows for preview table
        top_findings = results_df.head(100).to_dict(orient='records')
        
        summary = {
            "status": "success",
            "tested_count": int(len(results_df)),
            "above_bonferroni": int(results_df['p_value'].le(0.05 / len(results_df)).sum()) if len(results_df) > 0 else 0,
            "top_findings": top_findings
        }
        print(json.dumps(summary))
    else:
        # Check if the file wasn't generated because no codes met min_cases
        summary = {
            "status": "no_results",
            "message": "No Phecodes met the minimum case/control threshold requirements. Try reducing 'Min Cases' or check your Genotype covariate values."
        }
        print(json.dumps(summary))


def run_plot(args):
    """STEP 4: Generate PheWAS Manhattan plot."""
    run_dir = args.run_dir
    phecode_version = args.phecode_version
    
    results_path = os.path.join(run_dir, 'results.tsv')
    plot_output_path = os.path.join(run_dir, 'manhattan_plot.png')
    
    if not os.path.exists(results_path):
        raise FileNotFoundError(f"PheWAS results file not found at {results_path}. Run Step 3 (Statistics) first.")
        
    from phetk.plot import Plot
    
    # Check if there are converged records to plot
    results_df = pd.read_csv(results_path, sep='\t')
    if len(results_df) == 0:
        summary = {
            "status": "no_results",
            "message": "Results file is empty. Cannot generate plot."
        }
        print(json.dumps(summary))
        return
        
    plot_obj = Plot(
        phewas_result_file_path=results_path,
        phecode_version=phecode_version,
        converged_only=True
    )
    
    plot_obj.manhattan(output_file_path=plot_output_path)
    
    if os.path.exists(plot_output_path):
        summary = {
            "status": "success",
            "plot_file": "manhattan_plot.png"
        }
        print(json.dumps(summary))
    else:
        raise RuntimeError("Manhattan plot execution completed but file was not generated.")


def main():
    parser = argparse.ArgumentParser(description="PheTK Modular Pipeline Helper CLI")
    parser.add_argument("--step", required=True, choices=["map", "stats", "plot"], help="Pipeline step to execute")
    parser.add_argument("--run-dir", required=True, help="Session work directory path")
    parser.add_argument("--phecode-version", default="X", help="Phecode system version: 1.2 or X")
    parser.add_argument("--icd-version", default="US", help="ICD vocabulary mapping version: US, WHO, custom")
    
    # Step 2 mapping parameters
    parser.add_argument("--id-col", default="person_id", help="Patient identifier column name in phenotype file")
    parser.add_argument("--icd-col", default="ICD", help="ICD billing code column name in phenotype file")
    parser.add_argument("--vocab-col", default="vocabulary_id", help="Vocabulary ID column name in phenotype file")
    parser.add_argument("--date-col", default="date", help="Date of event column name in phenotype file")
    
    # Step 3 regression parameters
    parser.add_argument("--cohort-id-col", help="Participant identifier column name in cohort file")
    parser.add_argument("--independent-var", help="Genetic or other variable of interest column")
    parser.add_argument("--covariates", default="", help="Comma-separated covariate column names")
    parser.add_argument("--sex-col", default="sex", help="Sex column name")
    parser.add_argument("--male-as-one", default="true", help="Encoding logic for sex column (male=1/female=0 is true)")
    parser.add_argument("--min-cases", default="5", help="Minimum cases required to analyze a Phecode")
    parser.add_argument("--min-phecode-count", default="2", help="Minimum events required to flag a participant as case")

    args = parser.parse_args()
    
    try:
        if args.step == "map":
            run_map(args)
        elif args.step == "stats":
            run_stats(args)
        elif args.step == "plot":
            run_plot(args)
    except Exception as e:
        error_summary = {
            "status": "error",
            "message": str(e)
        }
        print(json.dumps(error_summary))
        sys.exit(1)

if __name__ == '__main__':
    main()
