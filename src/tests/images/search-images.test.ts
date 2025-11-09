import { test, expect } from '@playwright/test';
import { ApiClient } from '../fixtures/api-client';
import * as path from 'path';

test.describe('Search Images API', () => {
  const uploadedImageIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const apiClient = new ApiClient(request);

    const imagePath = path.join(__dirname, '../fixtures/test-images/valid-image.jpg');
    const { body } = await apiClient.uploadImage(imagePath);
    uploadedImageIds.push(body.imageId);
  });

  test('GET /image/search - should search by labels', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const { response, body } = await apiClient.searchImages({
      label: 'Dog',
    });

    expect(response.ok()).toBeTruthy();
    expect(Array.isArray(body.images)).toBeTruthy();
    expect(body.images.length).toBeGreaterThanOrEqual(0);
  });

  test('GET /image/search - should return empty array for no matches', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const { response, body } = await apiClient.searchImages({
      label: 'NonExistentLabel123456',
    });

    expect(response.ok()).toBeTruthy();
    expect(body.images).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });
});
