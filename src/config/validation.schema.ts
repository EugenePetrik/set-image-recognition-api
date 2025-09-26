export const validateEnvironmentVariables = (): void => {
  const requiredVars = ['AWS_S3_BUCKET_NAME', 'AWS_DYNAMODB_TABLE_NAME'];

  const missingVars: string[] = [];

  for (const varName of requiredVars) {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  }

  if (missingVars.length > 0) {
    throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
  }
};
