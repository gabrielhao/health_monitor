import { azureCosmosService } from '../../shared/services/azureCosmosService.js';
import type { HealthMetric } from '../../shared/types/index.js';

export interface HealthMetricsQueryOptions {
    metricType?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
}

export interface HealthMetricsCreateRequest {
    userId: string;
    metricType: string;
    value: number;
    unit: string;
    source: string;
    timestamp?: Date;
    metadata?: Record<string, any>;
}

class HealthMetricsService {
    async getHealthMetrics(userId: string, options: HealthMetricsQueryOptions = {}): Promise<HealthMetric[]> {
        try {
            return await azureCosmosService.getHealthMetrics(userId, options);
        } catch (error) {
            console.error('Error fetching health metrics:', error);
            throw new Error('Failed to fetch health metrics');
        }
    }

    async getMetricsCount(userId: string): Promise<number> {
        try {
            return await azureCosmosService.getMetricsCount(userId);
        } catch (error) {
            console.error('Error getting metrics count:', error);
            throw new Error('Failed to get metrics count');
        }
    }

    async getMetricTypes(userId: string): Promise<string[]> {
        try {
            const metrics = await azureCosmosService.getHealthMetrics(userId);
            const uniqueTypes = [...new Set(metrics.map((metric) => metric.metricType))];
            return uniqueTypes;
        } catch (error) {
            console.error('Error getting metric types:', error);
            throw new Error('Failed to get metric types');
        }
    }

    async getMetricsAggregated(
        userId: string,
        metricType: string,
        aggregationType: 'avg' | 'sum' | 'min' | 'max' | 'count',
        options: { startDate?: Date; endDate?: Date } = {},
    ): Promise<{ value: number; count: number }> {
        try {
            const metrics = await azureCosmosService.getHealthMetrics(userId, {
                metricType,
                ...options,
            });

            if (metrics.length === 0) {
                return { value: 0, count: 0 };
            }

            const values = metrics
                .map((metric) => (typeof metric.value === 'number' ? metric.value : parseFloat(metric.value.toString())))
                .filter((val) => !isNaN(val));

            if (values.length === 0) {
                return { value: 0, count: 0 };
            }

            let aggregatedValue: number;

            switch (aggregationType) {
                case 'avg':
                    aggregatedValue = values.reduce((sum, val) => sum + val, 0) / values.length;
                    break;
                case 'sum':
                    aggregatedValue = values.reduce((sum, val) => sum + val, 0);
                    break;
                case 'min':
                    aggregatedValue = Math.min(...values);
                    break;
                case 'max':
                    aggregatedValue = Math.max(...values);
                    break;
                case 'count':
                    aggregatedValue = values.length;
                    break;
                default:
                    throw new Error(`Unsupported aggregation type: ${aggregationType}`);
            }

            return { value: aggregatedValue, count: values.length };
        } catch (error) {
            console.error('Error getting aggregated metrics:', error);
            throw new Error('Failed to get aggregated metrics');
        }
    }
}

export const healthMetricsService = new HealthMetricsService();
