import { test, expect } from '@playwright/test';
import { ApiClient } from '../fixtures/api-client';

test.describe('Health Check API', () => {
  test('GET /health - should return basic health status', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const health = await apiClient.checkHealth();

    expect(health).toHaveProperty('status', 'healthy');
    expect(health).toHaveProperty('timestamp');
    expect(health).toHaveProperty('uptime');
    expect(health).toHaveProperty('environment');
    expect(health).toHaveProperty('version');
    expect(health).toHaveProperty('services');
  });
});
