import { Request, Response, Router } from 'express';
import { z } from 'zod';
import { IHealthMetricResponseContent } from '../../../shared/types/HealthMetricResponseContent';
import type { ApiResponse } from '../../../shared/types/index.js';
import { healthMetricsService } from '../healthMetricsService.js';

const router = Router();

// Validation schemas
const getMetricsSchema = z.object({
    userId: z.string(),
    metricType: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    limit: z.number().optional(),
});

const createMetricSchema = z.object({
    userId: z.string(),
    metricType: z.string(),
    value: z.number(),
    unit: z.string(),
    source: z.string(),
    timestamp: z.string().optional(),
    metadata: z.record(z.any()).optional(),
});

const createMetricsBatchSchema = z.array(createMetricSchema);

const deleteMetricsSchema = z.object({
    userId: z.string(),
    metricType: z.string().optional(),
});

const aggregateMetricsSchema = z.object({
    userId: z.string(),
    metricType: z.string(),
    aggregationType: z.enum(['avg', 'sum', 'min', 'max', 'count']),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
});

// Get health metrics
router.get('', async (req: Request, res: Response) => {
    try {
        const { userId, metricType, startDate, endDate, limit } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'userId is required as query parameter',
            } as ApiResponse);
        }

        const options: any = {};
        if (metricType && typeof metricType === 'string') {
            options.metricType = metricType;
        }
        if (startDate && typeof startDate === 'string') {
            options.startDate = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            options.endDate = new Date(endDate);
        }
        if (limit && typeof limit === 'string') {
            options.limit = parseInt(limit);
        }

        const metrics = await healthMetricsService.getHealthMetrics(userId, options);

        const results: IHealthMetricResponseContent[] = metrics.map((metric) => ({
            source: metric.source,
            unit: metric.unit ?? '',
            value: metric.value,
            metricType: metric.metricType,
            timestamp: metric.timestamp,
        }));

        res.json({
            success: true,
            data: results,
            message: `Retrieved ${results.length} health metrics`,
        } as ApiResponse);
    } catch (error) {
        console.error('Error fetching health metrics:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        } as ApiResponse);
    }
});

// Get metrics count
router.get('/count', async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'userId is required as query parameter',
            } as ApiResponse);
        }

        const count = await healthMetricsService.getMetricsCount(userId);

        res.json({
            success: true,
            data: { count },
            message: `User has ${count} health metrics`,
        } as ApiResponse);
    } catch (error) {
        console.error('Error getting metrics count:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        } as ApiResponse);
    }
});

// Get metric types
router.get('/types', async (req: Request, res: Response) => {
    try {
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'userId is required as query parameter',
            } as ApiResponse);
        }

        const types = await healthMetricsService.getMetricTypes(userId);

        res.json({
            success: true,
            data: { types },
            message: `Found ${types.length} metric types`,
        } as ApiResponse);
    } catch (error) {
        console.error('Error getting metric types:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        } as ApiResponse);
    }
});

// Get aggregated metrics
router.get('/aggregate', async (req: Request, res: Response) => {
    try {
        const { userId, metricType, aggregationType, startDate, endDate } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'userId is required as query parameter',
            } as ApiResponse);
        }

        if (!metricType || typeof metricType !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'metricType is required as query parameter',
            } as ApiResponse);
        }

        if (!aggregationType || !['avg', 'sum', 'min', 'max', 'count'].includes(aggregationType as string)) {
            return res.status(400).json({
                success: false,
                error: 'aggregationType must be one of: avg, sum, min, max, count',
            } as ApiResponse);
        }

        const options: any = {};
        if (startDate && typeof startDate === 'string') {
            options.startDate = new Date(startDate);
        }
        if (endDate && typeof endDate === 'string') {
            options.endDate = new Date(endDate);
        }

        const result = await healthMetricsService.getMetricsAggregated(userId, metricType, aggregationType as any, options);

        res.json({
            success: true,
            data: result,
            message: `Aggregated ${aggregationType} for ${metricType}: ${result.value}`,
        } as ApiResponse);
    } catch (error) {
        console.error('Error getting aggregated metrics:', error);
        res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Internal server error',
        } as ApiResponse);
    }
});

export default router;
