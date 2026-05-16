module.exports = {
  baseDir: '.next',
  defaultCompression: 'gzip',
  files: [
    {
      path: 'static/chunks/*.js',
      maxSize: '300kb',
    },
    {
      path: 'static/chunks/*.css',
      maxSize: '120kb',
    },
  ],
  groups: [
    {
      path: 'static/chunks/*.js',
      maxSize: '2mb',
    },
    {
      path: 'static/chunks/*.css',
      maxSize: '250kb',
    },
  ],
};
