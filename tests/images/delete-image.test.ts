import { test, expect } from '@playwright/test';
import { ApiClient } from '../fixtures/api-client';
import * as path from 'path';

test.describe('Delete Image API', () => {
  test('DELETE /image/:id - should delete existing image', async ({ request }) => {
    const imagePath = path.join(__dirname, '../fixtures/test-images/valid-image.jpg');
    const apiClient = new ApiClient(request);
    const { body: uploadBody } = await apiClient.uploadImage(imagePath);

    const { response, body } = await apiClient.deleteImage(uploadBody.imageId);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);
    expect(body).toHaveProperty('message', `Image ${uploadBody.imageId} deleted successfully`);

    const { response: getResponse } = await apiClient.getImage(uploadBody.imageId);
    expect(getResponse.status()).toBe(404);
  });

  test('DELETE /image/:id - should return 404 for non-existent image', async ({ request }) => {
    const apiClient = new ApiClient(request);
    const { response } = await apiClient.deleteImage('non-existent-id');

    expect(response.ok()).toBeFalsy();
    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(body).toHaveProperty('message', "Image with ID 'non-existent-id' not found");
  });
});
