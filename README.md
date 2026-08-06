# Image Viewer

A focused image viewer for VS Code and Cursor. Open an image from Explorer to view it directly without loading an image library or gallery first.

## Features

- Registers as an optional read-only editor for supported image files.
- Opens the selected image directly in the full-screen viewer.
- Shows the file name and dimensions, for example `image.png - 1630 x 1152px`.
- Previous/next navigation moves through supported images in the same folder.
- Navigating updates the selected file in Explorer and keeps focus on the viewer.
- Mouse-wheel zoom, double-click zoom, fit-to-window, 1:1 view, zoom presets and minimap navigation.
- Rotation and mirror controls are intentionally omitted from the bottom toolbar.
- No image-library command, thumbnail grid, folder context menu or file context menu.

## Setup

1. Install the extension.
2. Open the Command Palette with `Ctrl+Shift+P` / `⌘⇧P`.
3. Run **Image Viewer: Use as Default Image Editor**.
4. Click a supported image in Explorer.

Run **Image Viewer: Restore VS Code's Default Image Editor** to remove the global file associations.

You can also use **Reopen Editor With...** to select Image Viewer for an individual file.

## Supported formats

SVG, PNG, JPEG/JPG, ICO, GIF, WebP, BMP, TIFF, APNG and AVIF.

## Navigation

Images are ordered by file name using natural numeric sorting. When the viewer moves to another image, the corresponding file is revealed and selected in Explorer.

## More documentation

- See **[CHANGELOG.md](./CHANGELOG.md)** for release notes
- Issues: [GitHub Issues](https://github.com/ZhangJian1713/vscode-image-viewer/issues)

## Questions or feedback

zhangjian1713@gmail.com
