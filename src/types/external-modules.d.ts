/**
 * 외부 모듈 타입 선언
 * ml-kmeans 등 타입 선언이 없는 모듈들을 위한 타입 정의
 */

declare module 'ml-kmeans' {
  interface KMeansOptions {
    maxIterations?: number;
    tolerance?: number;
    distanceFunction?: (a: number[], b: number[]) => number;
    seed?: number;
  }

  interface KMeansResult {
    clusters: number[][];
    centroids: number[][];
    iterations: number;
    converged: boolean;
  }

  class KMeans {
    constructor(data: number[][], k: number, options?: KMeansOptions);
    getClusters(): number[][];
    getCentroids(): number[][];
    getIterations(): number;
    isConverged(): boolean;
  }

  export default KMeans;
}

declare module 'whatwg-fetch';

export {};
