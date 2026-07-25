/**
 * electron-builder `artifactBuildCompleted` hook.
 *
 * Injects an empty `FerdiumAppData` folder into the Windows zip artifact so
 * that simply extracting the zip yields a portable installation: the folder
 * is the marker that switches Ferdium into portable mode, keeping all data
 * next to the executable instead of on the host machine.
 *
 * The folder is added to the zip artifact only. The shared win-unpacked
 * directory must stay clean, otherwise the NSIS installer and the portable
 * stub would ship the marker too and installed copies would wrongly run in
 * portable mode.
 */
exports.default = async function embedPortableMarker(artifact) {
  const { file, target, packager } = artifact;

  if (
    !target ||
    target.name !== 'zip' ||
    !file.endsWith('.zip') ||
    packager.platform.name !== 'windows'
  ) {
    return;
  }

  // eslint-disable-next-line global-require
  const AdmZip = require('adm-zip');

  const zip = new AdmZip(file);
  if (!zip.getEntry('FerdiumAppData/')) {
    zip.addFile('FerdiumAppData/', Buffer.alloc(0));
    zip.writeZip(file);
    // eslint-disable-next-line no-console
    console.log(`  • embedded portable marker folder in ${file}`);
  }
};
