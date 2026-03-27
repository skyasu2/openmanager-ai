/**
 * 🐍 Pyodide Service - Browser-based Python Execution
 *
 * Provides a sandboxed Python environment using Pyodide (WebAssembly).
 * Zero server cost, runs entirely in the user's browser.
 *
 * @version 1.0.0
 * @created 2025-12-18
 */

import { logger } from '@/lib/logging';

// Pyodide types
interface PyodideInterface {
  runPython: (code: string) => unknown;
  runPythonAsync: (code: string) => Promise<unknown>;
  loadPackage: (packages: string | string[]) => Promise<void>;
  loadPackagesFromImports: (code: string) => Promise<void>;
  globals: {
    get: (name: string) => unknown;
    set: (name: string, value: unknown) => void;
  };
  FS: {
    writeFile: (path: string, data: string | Uint8Array) => void;
    readFile: (
      path: string,
      opts?: { encoding: string }
    ) => string | Uint8Array;
  };
  isPyProxy: (obj: unknown) => boolean;
}

declare global {
  interface Window {
    loadPyodide?: (config?: { indexURL?: string }) => Promise<PyodideInterface>;
  }
}

export interface ExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
  plots?: string[]; // Base64 encoded plot images
}

export interface PyodideServiceConfig {
  indexURL?: string;
  preloadPackages?: string[];
}

/**
 * Pyodide Service Singleton
 *
 * Manages Pyodide lifecycle and provides safe code execution.
 */
class PyodideService {
  private pyodide: PyodideInterface | null = null;
  private isLoading = false;
  private loadPromise: Promise<void> | null = null;
  private isInitialized = false;

  // Pre-installed packages for data science
  private readonly DEFAULT_PACKAGES = [
    'numpy',
    'pandas',
    'matplotlib',
    'scipy',
  ];

  /**
   * Load Pyodide runtime
   */
  async initialize(config?: PyodideServiceConfig): Promise<void> {
    if (this.isInitialized && this.pyodide) {
      return;
    }

    if (this.isLoading && this.loadPromise) {
      return this.loadPromise;
    }

    this.isLoading = true;
    this.loadPromise = this._loadPyodide(config);

    try {
      await this.loadPromise;
      this.isInitialized = true;
    } finally {
      this.isLoading = false;
    }
  }

  private async _loadPyodide(config?: PyodideServiceConfig): Promise<void> {
    // Check if we're in browser environment
    if (typeof window === 'undefined') {
      throw new Error('Pyodide는 브라우저 환경에서만 실행 가능합니다.');
    }

    // Load Pyodide script if not already loaded
    if (!window.loadPyodide) {
      await this._loadScript(
        config?.indexURL ||
          'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js'
      );
    }

    if (!window.loadPyodide) {
      throw new Error('Pyodide 스크립트 로드에 실패했습니다.');
    }

    // Initialize Pyodide
    logger.info('🐍 [Pyodide] 초기화 중...');
    const startTime = Date.now();

    this.pyodide = await window.loadPyodide({
      indexURL:
        config?.indexURL || 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
    });

    // Setup matplotlib for inline plotting
    await this._setupMatplotlib();

    // Preload common packages
    const packagesToLoad = config?.preloadPackages || this.DEFAULT_PACKAGES;
    logger.info(`🐍 [Pyodide] 패키지 로드 중: ${packagesToLoad.join(', ')}`);
    await this.pyodide.loadPackage(packagesToLoad);

    const loadTime = Date.now() - startTime;
    logger.info(`🐍 [Pyodide] 초기화 완료 (${loadTime}ms)`);
  }

  private async _loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`스크립트 로드 실패: ${src}`));
      document.head.appendChild(script);
    });
  }

  private async _setupMatplotlib(): Promise<void> {
    if (!this.pyodide) return;

    // Configure matplotlib to use a non-interactive backend
    await this.pyodide.runPythonAsync(`
import sys
import io

# Setup matplotlib for inline plotting
import matplotlib
matplotlib.use('AGG')
import matplotlib.pyplot as plt

# Helper function to capture plot as base64
def _capture_plot():
    import base64
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=100, bbox_inches='tight')
    buf.seek(0)
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    plt.close()
    return img_base64

# Redirect stdout for capturing print output
class OutputCapture:
    def __init__(self):
        self.contents = []
    def write(self, text):
        self.contents.append(text)
    def flush(self):
        pass
    def get_output(self):
        return ''.join(self.contents)
    def clear(self):
        self.contents = []
`);
  }

  /**
   * Execute Python code safely
   */
  async execute(code: string): Promise<ExecutionResult> {
    if (!this.pyodide || !this.isInitialized) {
      throw new Error(
        'Pyodide가 초기화되지 않았습니다. initialize()를 먼저 호출하세요.'
      );
    }

    const startTime = Date.now();

    try {
      // Auto-load required packages from imports
      await this.pyodide.loadPackagesFromImports(code);

      // Setup output capture
      await this.pyodide.runPythonAsync(`
_output_capture = OutputCapture()
sys.stdout = _output_capture
sys.stderr = _output_capture
_plot_images = []
`);

      // Execute the user code
      const result = await this.pyodide.runPythonAsync(code);

      // Capture any plots
      await this.pyodide.runPythonAsync(`
import matplotlib.pyplot as plt
if plt.get_fignums():
    _plot_images.append(_capture_plot())
`);

      // Get captured output and plots
      const output = await this.pyodide.runPythonAsync(
        '_output_capture.get_output()'
      );
      const plotImages = await this.pyodide.runPythonAsync('_plot_images');

      // Reset stdout
      await this.pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
_output_capture.clear()
_plot_images = []
`);

      const executionTime = Date.now() - startTime;

      // Format result
      let outputStr = String(output || '');
      if (
        result !== undefined &&
        result !== null &&
        String(result) !== 'None'
      ) {
        if (outputStr) {
          outputStr += '\n';
        }
        outputStr += `결과: ${String(result)}`;
      }

      return {
        success: true,
        output: outputStr || '코드가 성공적으로 실행되었습니다.',
        executionTime,
        plots: Array.isArray(plotImages) ? (plotImages as string[]) : [],
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      // Reset stdout on error
      try {
        await this.pyodide.runPythonAsync(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  /**
   * Check if Pyodide is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.pyodide !== null;
  }

  /**
   * Get loading status
   */
  isLoadingPyodide(): boolean {
    return this.isLoading;
  }

  /**
   * Load additional packages
   */
  async loadPackages(packages: string[]): Promise<void> {
    if (!this.pyodide) {
      throw new Error('Pyodide가 초기화되지 않았습니다.');
    }
    await this.pyodide.loadPackage(packages);
  }

  /**
   * Write a file to the virtual filesystem
   */
  writeFile(path: string, content: string): void {
    if (!this.pyodide) {
      throw new Error('Pyodide가 초기화되지 않았습니다.');
    }
    this.pyodide.FS.writeFile(path, content);
  }

  /**
   * Read a file from the virtual filesystem
   */
  readFile(path: string): string {
    if (!this.pyodide) {
      throw new Error('Pyodide가 초기화되지 않았습니다.');
    }
    return this.pyodide.FS.readFile(path, { encoding: 'utf8' }) as string;
  }
}

// Export singleton instance
export const pyodideService = new PyodideService();
