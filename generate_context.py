import os

# Configuration
OUTPUT_FILE = 'llm_context.md'
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))

# File types to include
EXTENSIONS = {
    '.py', '.js', '.jsx', '.ts', '.tsx', 
    '.html', '.css', '.json', '.sh'
}

# Directories to exclude
EXCLUDE_DIRS = {
    'node_modules', '.git', '__pycache__', 'dist', 'build', 
    'venv', 'coverage', '.vscode', '.idea', 'frontend_vanilla', 'out'
}

# Specific files to exclude
EXCLUDE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 
    '.DS_Store', 'generate_context.py', OUTPUT_FILE,
    'shaking-head.html'
}

def main():
    print(f"Generating context from {ROOT_DIR} into {OUTPUT_FILE}...")
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as out_f:
        # Write header
        out_f.write(f"# Project Context\n\n")
        
        for root, dirs, files in os.walk(ROOT_DIR):
            # Modify dirs in-place to skip ignored directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith('.')]
            
            for file in sorted(files):
                # Skip excluded files and hidden files
                if file in EXCLUDE_FILES or file.startswith('.'):
                    continue
                
                # Check extension
                _, ext = os.path.splitext(file)
                if ext not in EXTENSIONS:
                    continue
                
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, ROOT_DIR)
                
                print(f"Processing: {rel_path}")
                
                out_f.write(f"## File: {rel_path}\n")
                out_f.write(f"```{'python' if ext == '.py' else ext[1:]}\n")
                
                try:
                    with open(file_path, 'r', encoding='utf-8') as in_f:
                        content = in_f.read()
                        out_f.write(content)
                except Exception as e:
                    out_f.write(f"[Error reading file: {e}]")
                
                out_f.write("\n```\n\n")

    print(f"Done. Context saved to {OUTPUT_FILE}")

if __name__ == '__main__':
    main()
