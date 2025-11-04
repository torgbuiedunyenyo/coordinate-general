// Performance monitoring utility for generation timing
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiCalls: [],
      batchTimes: [],
      totalGenerations: 0,
      startTime: null,
      endTime: null
    };
  }

  startSession() {
    this.metrics.startTime = Date.now();
    console.log('[Performance] Session started');
  }

  endSession() {
    this.metrics.endTime = Date.now();
    const totalTime = (this.metrics.endTime - this.metrics.startTime) / 1000;
    console.log('[Performance] Session completed in', totalTime.toFixed(2), 'seconds');
    this.logSummary();
  }

  startApiCall(identifier) {
    const callId = `${identifier}-${Date.now()}`;
    const startTime = Date.now();
    
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.metrics.apiCalls.push({
          identifier,
          duration,
          timestamp: startTime
        });
        this.metrics.totalGenerations++;
        console.log(`[Performance] API call for ${identifier} took ${duration}ms`);
        return duration;
      }
    };
  }

  startBatch(batchSize, ringOrRound) {
    const startTime = Date.now();
    console.log(`[Performance] Starting batch of ${batchSize} for ${ringOrRound}`);
    
    return {
      end: () => {
        const duration = Date.now() - startTime;
        this.metrics.batchTimes.push({
          batchSize,
          ringOrRound,
          duration,
          avgPerItem: duration / batchSize
        });
        console.log(`[Performance] Batch completed in ${duration}ms (avg ${(duration/batchSize).toFixed(0)}ms per item)`);
      }
    };
  }

  logSummary() {
    if (this.metrics.apiCalls.length === 0) return;
    
    const avgApiTime = this.metrics.apiCalls.reduce((sum, call) => sum + call.duration, 0) / this.metrics.apiCalls.length;
    const minApiTime = Math.min(...this.metrics.apiCalls.map(c => c.duration));
    const maxApiTime = Math.max(...this.metrics.apiCalls.map(c => c.duration));
    
    console.log('=== Performance Summary ===');
    console.log(`Total generations: ${this.metrics.totalGenerations}`);
    console.log(`API call times: avg ${avgApiTime.toFixed(0)}ms, min ${minApiTime}ms, max ${maxApiTime}ms`);
    
    if (this.metrics.batchTimes.length > 0) {
      const avgBatchTime = this.metrics.batchTimes.reduce((sum, b) => sum + b.duration, 0) / this.metrics.batchTimes.length;
      console.log(`Batch processing: avg ${avgBatchTime.toFixed(0)}ms per batch`);
    }
    
    // Store summary in sessionStorage for debugging
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('performanceMetrics', JSON.stringify(this.metrics));
    }
  }

  reset() {
    this.metrics = {
      apiCalls: [],
      batchTimes: [],
      totalGenerations: 0,
      startTime: null,
      endTime: null
    };
  }
}

// Export singleton instance
export const perfMonitor = new PerformanceMonitor();
