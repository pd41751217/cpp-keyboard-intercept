const fs = require('fs');
const path = require('path');

console.log('---------------copy-natives');

const nativeFilesToCopy = [
  {
    source: path.join(__dirname, '../public'),
    destination: path.join(__dirname, '../../../dist/apps/app-electron/public'),
  },
  {
    source: path.join(__dirname, '../builders/app.package.json'),
    destination: path.join(__dirname, '../../../dist/apps/app-electron/package.json'),
  },
];

const copyFiles = (src, dest) => {
  // Check if source exists
  if (!fs.existsSync(src)) {
    console.log(`Source path does not exist: ${src}`);
    return;
  }

  // If source is a file, copy it directly
  if (!fs.lstatSync(src).isDirectory()) {
    fs.copyFileSync(src, dest);
    return;
  }

  // If source is a directory
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  fs.readdirSync(src).forEach((file) => {
    const srcFile = path.join(src, file);
    const destFile = path.join(dest, file);

    if (fs.lstatSync(srcFile).isDirectory()) {
      // Recursively copy the entire directory
      copyFiles(srcFile, destFile);
    } else {
      fs.copyFileSync(srcFile, destFile);
    }
  });
};

nativeFilesToCopy.forEach((file) => {
  if (!fs.existsSync(path.dirname(file.destination))) {
    fs.mkdirSync(path.dirname(file.destination), { recursive: true });
  }
  copyFiles(file.source, file.destination);
});
