import { test, expect } from '@playwright/test';
import { ApiClient } from '../fixtures/api-client';
import * as path from 'path';

test.describe('Image Upload API', () => {
  test('POST /image/upload - should upload valid JPEG image', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const imagePath = path.join(__dirname, '../fixtures/test-images/valid-image.jpg');
    const { response, body } = await apiClient.uploadImage(imagePath);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(201);

    expect(body).toHaveProperty('imageId');
    expect(body).toHaveProperty('imageUrl');
    expect(body).toHaveProperty('uploadedAt');
    expect(body).toHaveProperty('message');

    expect(body.message).toBe('Image uploaded successfully. Recognition process started.');
  });

  test('POST /image/upload - should reject request without file', async ({ request }) => {
    const response = await request.post('/api/v1/image', {
      multipart: {},
    });

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('message', 'No file provided');
  });
});
