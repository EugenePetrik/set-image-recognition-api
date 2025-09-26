import {
  Controller,
  Post,
  Get,
  Delete,
  Query,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  Body,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ImagesService, GetAllImagesResponseDto, SearchImagesResponseDto } from '../services/images.service';
import { UploadImageDto } from '../dto/upload-image.dto';
import { ImageUploadResponseDto } from '../dto/image-upload-response.dto';
import { GetAllImagesDto } from '../dto/get-all-images.dto';
import { SearchImagesDto } from '../dto/search-images.dto';
import { ImageResponseDto } from '../dto/image-response.dto';
import { LabelResponseDto } from '../dto/label-response.dto';

@ApiTags('image')
@Controller('image')
export class ImagesController {
  private readonly logger = new Logger(ImagesController.name);

  constructor(private readonly imagesService: ImagesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all images with pagination and filters',
    description: 'Retrieve a paginated list of all uploaded images with their metadata',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Images retrieved successfully',
  })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10, max: 100)' })
  async getAllImages(@Query() query: GetAllImagesDto): Promise<GetAllImagesResponseDto> {
    this.logger.log('Retrieving all images with pagination');
    return this.imagesService.getAllImages(query);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Search images by label with confidence filtering',
    description: 'Find images that contain specific labels detected by AWS Rekognition',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Images found successfully',
  })
  @ApiQuery({ name: 'label', required: true, description: 'Label name to search for' })
  @ApiQuery({ name: 'confidence', required: false, description: 'Minimum confidence score (0-100, default: 80)' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Items per page (default: 10, max: 100)' })
  async searchImagesByLabel(@Query() searchDto: SearchImagesDto): Promise<SearchImagesResponseDto> {
    this.logger.log(`Searching images by label: ${searchDto.label}`);
    return this.imagesService.searchImagesByLabel(searchDto);
  }

  @Get('labels')
  @ApiOperation({
    summary: 'Get all available labels with usage statistics',
    description: 'Retrieve all unique labels detected across images with count and confidence statistics',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Labels retrieved successfully',
    type: LabelResponseDto,
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Maximum number of labels (default: 50, max: 100)' })
  @ApiQuery({ name: 'minCount', required: false, description: 'Minimum image count per label (default: 1)' })
  async getAllLabels(@Query() query: { limit?: number; minCount?: number }): Promise<LabelResponseDto> {
    this.logger.log('Retrieving all available labels');
    return this.imagesService.getAllLabels(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get image metadata by ID',
    description: 'Retrieve detailed metadata for a specific image including labels and confidence scores',
  })
  @ApiParam({ name: 'id', description: 'Unique image identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image metadata retrieved successfully',
    type: ImageResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Image not found',
  })
  async getImageById(@Param('id') id: string): Promise<ImageResponseDto> {
    this.logger.log(`Retrieving image metadata for ID: ${id}`);
    return this.imagesService.getImageById(id);
  }

  @Get('file/:id')
  @ApiOperation({
    summary: 'Download/stream image file by ID',
    description: 'Get the actual image file as binary data',
  })
  @ApiParam({ name: 'id', description: 'Unique image identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image file binary data',
    content: {
      'image/jpeg': { schema: { type: 'string', format: 'binary' } },
      'image/png': { schema: { type: 'string', format: 'binary' } },
      'image/webp': { schema: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Image file not found',
  })
  async getImageFile(@Param('id') id: string, @Res() res: Response): Promise<void> {
    this.logger.log(`Streaming image file for ID: ${id}`);
    return this.imagesService.getImageFile(id, res);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload an image for recognition',
    description: 'Upload an image file to be processed by AWS Rekognition for label detection',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Image file and optional metadata',
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, GIF, WebP - max 5MB)',
        },
        description: {
          type: 'string',
          description: 'Optional description for the image',
          maxLength: 500,
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Image uploaded successfully',
    type: ImageUploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or upload failed',
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(
    @UploadedFile() file: Express.Multer.File,
    @Body() uploadDto: UploadImageDto,
  ): Promise<ImageUploadResponseDto> {
    this.logger.log(`Received image upload request: ${file?.originalname}`);
    return this.imagesService.uploadImage(file, uploadDto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete image and its metadata',
    description: 'Permanently delete an image file from S3 and remove all associated metadata',
  })
  @ApiParam({ name: 'id', description: 'Unique image identifier' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Image deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Image not found',
  })
  async deleteImage(@Param('id') id: string): Promise<{ message: string }> {
    this.logger.log(`Deleting image with ID: ${id}`);
    return this.imagesService.deleteImage(id);
  }
}
