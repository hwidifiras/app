import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const desktop = path.join(project, 'desktop');
const requireDesktop = createRequire(path.join(desktop, 'package.json'));
const { build, Platform, Arch } = requireDesktop('electron-builder');
const { NsisTarget } = requireDesktop('app-builder-lib/out/targets/nsis/NsisTarget.js');
const { nsisTemplatesDir, UninstallerReader } = requireDesktop('app-builder-lib/out/targets/nsis/nsisUtil.js');
const version = requireDesktop('app-builder-lib/package.json').version;
if (version !== '26.15.3') throw new Error('Review the NSIS extraction adapter before changing electron-builder.');

// The pinned SDK normally executes a temporary installer to write its uninstaller.
// Use its existing pure Node binary reader instead, as its macOS build path does.
// Nothing generated is executed at build time; Windows policy remains enforced
// when the user runs the final installer. Standard NSIS install/uninstall logic,
// update identity, shortcuts and data-preservation options remain unchanged.
NsisTarget.prototype.computeScriptAndSignUninstaller = async function (defines, commands, installerPath, sharedHeader, archs) {
  if (this.options.script) throw new Error('Custom installer scripts require their own reviewed build path.');
  const script = await readFile(path.join(nsisTemplatesDir, 'installer.nsi'), 'utf8');
  const uninstallerPath = path.join(this.outDir, `${path.basename(installerPath, 'exe')}__uninstaller.exe`);
  defines.BUILD_UNINSTALLER = null;
  defines.UNINSTALLER_OUT_FILE = uninstallerPath;
  await this.executeMakensis(defines, commands, sharedHeader + await this.computeFinalScript(script, false, archs));
  await UninstallerReader.exec(installerPath, uninstallerPath);
  await this.packager.signIf(uninstallerPath);
  delete defines.BUILD_UNINSTALLER;
  defines.UNINSTALLER_OUT_FILE = uninstallerPath;
  return { script, isCustomScript: false };
};

await build({ projectDir: desktop, targets: Platform.WINDOWS.createTarget('nsis', Arch.x64), prepackaged: path.join(project, 'release/win-unpacked'), publish: 'never' });
