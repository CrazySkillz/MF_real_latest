#!/usr/bin/env python3
import os
import sys
import subprocess
import uvicorn

def main():
    # Change to the api directory where our Python files are
    api_dir = os.path.join(os.path.dirname(__file__), 'api')
    if os.path.exists(api_dir):
        os.chdir(api_dir)
    
    # Start the FastAPI server
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=True,
        log_level="info"
    )

if __name__ == "__main__":
    main()