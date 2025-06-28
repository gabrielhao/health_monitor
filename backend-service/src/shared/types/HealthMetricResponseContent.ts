export interface IHealthMetricResponseContent {
    source: string;
    unit: string;
    value: number | string | undefined;
    timestamp: string | Date;
    metricType: string | undefined;
}
