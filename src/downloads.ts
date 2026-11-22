/** What can be downloaded: the app for each system, in each architecture and
 * format the builder makes (builder/build.sh), and the server for the other
 * machines a project runs on. Nothing is out yet: `ready` turns a file's
 * button on. */

export const version = "0.3.1";
/** Whether the builds are out. Until then every button says "Soon". */
export const ready = false;

export interface Format {
  id: string;
  label: string;
  /** What it is, in a few words. */
  note: string;
  file: (arch: string) => string;
}
export interface Arch {
  id: string;
  label: string;
}
export interface Platform {
  id: "mac" | "win" | "linux";
  label: string;
  icon: string;
  archs: Arch[];
  formats: Format[];
}

const v = version;

export const platforms: Platform[] = [
  {
    id: "mac",
    label: "macOS",
    icon: "os-mac",
    archs: [
      { id: "arm64", label: "Apple silicon" },
      { id: "x64", label: "Intel" },
    ],
    formats: [
      { id: "dmg", label: "Disk image", note: "Drag it to Applications", file: (a) => `hyperpane-${v}-mac-${a}.dmg` },
      { id: "zip", label: "Zip", note: "The app, unpacked anywhere", file: (a) => `hyperpane-${v}-mac-${a}.zip` },
    ],
  },
  {
    id: "win",
    label: "Windows",
    icon: "os-win",
    archs: [{ id: "x64", label: "x64" }],
    formats: [
      { id: "setup", label: "Installer", note: "Installs it for you, with a Start menu entry", file: (a) => `hyperpane-${v}-win-${a}-setup.exe` },
      { id: "portable", label: "Portable", note: "Runs without installing", file: (a) => `hyperpane-${v}-win-${a}-portable.exe` },
    ],
  },
  {
    id: "linux",
    label: "Linux",
    icon: "os-linux",
    archs: [
      { id: "x64", label: "x64" },
      { id: "arm64", label: "arm64" },
    ],
    formats: [
      { id: "appimage", label: "AppImage", note: "One file: make it executable and run it", file: (a) => `hyperpane-${v}-linux-${a}.AppImage` },
      { id: "tar", label: "Tarball", note: "The app, unpacked anywhere", file: (a) => `hyperpane-${v}-linux-${a}.tar.gz` },
    ],
  },
];

/** The server alone, for a machine you reach over the network: the app on
 * your computer connects to it. */
export const servers = [
  { os: "Linux", icon: "os-linux", arch: "x64", file: `hyperpane-server-${v}-x86_64-unknown-linux-gnu.tar.xz` },
  { os: "Linux", icon: "os-linux", arch: "arm64", file: `hyperpane-server-${v}-aarch64-unknown-linux-gnu.tar.xz` },
  { os: "macOS", icon: "os-mac", arch: "Apple silicon", file: `hyperpane-server-${v}-aarch64-apple-darwin.tar.xz` },
  { os: "macOS", icon: "os-mac", arch: "Intel", file: `hyperpane-server-${v}-x86_64-apple-darwin.tar.xz` },
  { os: "Windows", icon: "os-win", arch: "x64", file: `hyperpane-server-${v}-x86_64-pc-windows-msvc.zip` },
];
