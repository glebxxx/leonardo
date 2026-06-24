// Renders a macOS-style "card" app icon from a source image:
// rounded-rect tile (Apple 1024 grid: 824 body, ~185 radius, 100 margin),
// the source image clipped inside, a subtle inner border and a soft drop shadow.
// Usage: swift make-icon.swift <source.png> <out.png>

import AppKit

let args = CommandLine.arguments
guard args.count >= 3 else {
    FileHandle.standardError.write("usage: make-icon.swift <src> <out>\n".data(using: .utf8)!)
    exit(2)
}
let srcPath = args[1]
let outPath = args[2]

guard let src = NSImage(contentsOfFile: srcPath) else {
    FileHandle.standardError.write("cannot load \(srcPath)\n".data(using: .utf8)!)
    exit(1)
}

let size: CGFloat = 1024
let margin: CGFloat = 100                       // Apple grid: 100px around an 824 body
let tile = NSRect(x: margin, y: margin, width: size - 2 * margin, height: size - 2 * margin)
let radius: CGFloat = tile.width * 0.2237       // squircle-approximating corner radius

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil, pixelsWide: Int(size), pixelsHigh: Int(size),
    bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
    colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0
) else { exit(1) }
rep.size = NSSize(width: size, height: size)

NSGraphicsContext.saveGraphicsState()
let gctx = NSGraphicsContext(bitmapImageRep: rep)!
NSGraphicsContext.current = gctx

let body = NSBezierPath(roundedRect: tile, xRadius: radius, yRadius: radius)

// Soft drop shadow under the tile (drawn with the parchment fill).
gctx.saveGraphicsState()
let shadow = NSShadow()
shadow.shadowColor = NSColor(white: 0, alpha: 0.30)
shadow.shadowBlurRadius = 26
shadow.shadowOffset = NSSize(width: 0, height: -12)
shadow.set()
NSColor(calibratedRed: 0.937, green: 0.910, blue: 0.847, alpha: 1).setFill() // parchment, hidden by image
body.fill()
gctx.restoreGraphicsState()

// Clip to the rounded tile and draw the image (aspect-fill).
gctx.saveGraphicsState()
body.addClip()
let s = src.size
let scale = max(tile.width / s.width, tile.height / s.height)
let dw = s.width * scale, dh = s.height * scale
let drawRect = NSRect(x: tile.midX - dw / 2, y: tile.midY - dh / 2, width: dw, height: dh)
src.draw(in: drawRect, from: .zero, operation: .sourceOver, fraction: 1.0)
gctx.restoreGraphicsState()

// Subtle inner border (the "рамка").
let border = NSBezierPath(roundedRect: tile.insetBy(dx: 1, dy: 1), xRadius: radius, yRadius: radius)
NSColor(white: 0, alpha: 0.14).setStroke()
border.lineWidth = 2
border.stroke()

NSGraphicsContext.restoreGraphicsState()

guard let data = rep.representation(using: .png, properties: [:]) else { exit(1) }
do {
    try data.write(to: URL(fileURLWithPath: outPath))
    print("wrote \(outPath)")
} catch {
    FileHandle.standardError.write("write failed: \(error)\n".data(using: .utf8)!)
    exit(1)
}
