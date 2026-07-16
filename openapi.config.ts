import type { UserConfig } from './src/config/schema';

const config: UserConfig = {
  info: {
    title: 'Example API',
    version: '1.0.0',
    description: 'An example API using @mmtq/hono-swagger'
  },
  servers: [
    { url: 'http://localhost:3000', description: 'Local Development Server' }
  ],
  include: ['example/**/*.ts'],
  outputDir: 'example/docs',
  formats: ['json', 'yaml']
};

export default config;
