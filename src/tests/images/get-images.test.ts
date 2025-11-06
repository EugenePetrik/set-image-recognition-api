import { test, expect } from '@playwright/test';
import { ApiClient } from '../fixtures/api-client';
import * as path from 'path';

test.describe('Get Images API', () => {
  const uploadedImageIds: string[] = [];

  test.beforeAll(async ({ request }) => {
    const apiClient = new ApiClient(request);

    const imagePath = path.join(__dirname, '../fixtures/test-images/valid-image.jpg');
    const { body } = await apiClient.uploadImage(imagePath);
    uploadedImageIds.push(body.imageId);
  });

  test('GET /image - should return all images', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const { response, body } = await apiClient.getAllImages();

    expect(response.ok()).toBeTruthy();
    expect(Array.isArray(body.images)).toBeTruthy();
    expect(body.images.length).toBeGreaterThan(0);
  });

  test('GET /image/:id - should return single image', async ({ request }) => {
    const imageId = uploadedImageIds[0];

    const apiClient = new ApiClient(request);
    const { response, body } = await apiClient.getImage(imageId);

    expect(response.ok()).toBeTruthy();
    expect(body).toHaveProperty('id', imageId);
    expect(body).toHaveProperty('name');
    expect(body).toHaveProperty('url');
    expect(body).toHaveProperty('labels', []);
    expect(body).toHaveProperty('uploadedAt');
    expect(body).toHaveProperty('size');
    expect(body).toHaveProperty('mimeType', 'image/jpeg');
    expect(body).toHaveProperty('status', 'uploading');
  });

  test('GET /image/:id - should return 404 for non-existent image', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const { response, body } = await apiClient.getImage('non-existent-id');

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
    expect(body).toHaveProperty('message', "Image with ID 'non-existent-id' not found");
  });
});
