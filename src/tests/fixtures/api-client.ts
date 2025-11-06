import { APIRequestContext, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

export class ApiClient {
  constructor(private request: APIRequestContext) {}

  async checkHealth() {
    const response = await this.request.get('/api/v1/health');
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async uploadImage(filePath: string, metadata?: Record<string, string>) {
    const file = fs.readFileSync(filePath);
    const fileName = path.basename(filePath);

    const formData = {
      file: {
        name: fileName,
        mimeType: this.getMimeType(fileName),
        buffer: file,
      },
    };

    if (metadata) {
      Object.assign(formData, metadata);
    }

    const response = await this.request.post('/api/v1/image', {
      multipart: formData,
    });

    return { response, body: await response.json() };
  }

  async getAllImages(params?: { page?: number; limit?: number; sortBy?: string; sortOrder?: 'asc' | 'desc' }) {
    const queryParams = new URLSearchParams();

    if (params?.page) queryParams.set('page', params.page.toString());
    if (params?.limit) queryParams.set('limit', params.limit.toString());
    if (params?.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params?.sortOrder) queryParams.set('sortOrder', params.sortOrder);

    const url = `/api/v1/image${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    const response = await this.request.get(url);

    return { response, body: await response.json() };
  }

  async getImage(imageId: string) {
    const response = await this.request.get(`/api/v1/image/${imageId}`);
    return { response, body: await response.json() };
  }

  async searchImages(query: { label: string }) {
    const response = await this.request.get('/api/v1/image/search', {
      params: query,
    });
    return { response, body: await response.json() };
  }

  async deleteImage(imageId: string) {
    const response = await this.request.delete(`/api/v1/image/${imageId}`);
    return { response, body: response.ok() ? await response.json() : null };
  }

  private getMimeType(fileName: string): string {
    const ext = path.extname(fileName).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }
}
