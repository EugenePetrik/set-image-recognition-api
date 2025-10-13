data "aws_ecr_repository" "image_recognition" {
  name = "image-recognition-api"
}

resource "aws_ecr_lifecycle_policy" "image_recognition_policy" {
  repository = data.aws_ecr_repository.image_recognition.name

  policy = jsonencode({
    rules = [{
      rulePriority = 1
      description  = "Keep last 10 images"
      selection = {
        tagStatus     = "tagged"
        tagPrefixList = ["v"]
        countType     = "imageCountMoreThan"
        countNumber   = 10
      }
      action = {
        type = "expire"
      }
    }]
  })
}
