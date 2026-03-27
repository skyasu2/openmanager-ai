module.exports = {
  '*.{ts,tsx,js,jsx}': ['npm run hook:pre-commit'],
  '*.{json,md,mdx,css,scss}': ['prettier --write'],
};
