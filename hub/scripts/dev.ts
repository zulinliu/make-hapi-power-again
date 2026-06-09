process.env.CLI_API_TOKEN ??= '123456'
process.env.NODE_ENV ??= 'development'

await import('../src/index')
