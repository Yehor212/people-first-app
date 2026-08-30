import AVFoundation
import Foundation

// Frame-level inspector for Android motion evidence captures.
// Emits a JSON summary with duration and decoded sample counts so the
// visual-runtime gate can verify recordings without trusting metadata alone.

func loadTracks(asset: AVURLAsset) throws -> [AVAssetTrack] {
    return try asset.loadTracks(withMediaType: .video)
}

func inspectVideo(path: String) throws {
    let url = URL(fileURLWithPath: path)
    let asset = AVURLAsset(url: url)
    let durationSeconds = try asset.load(.duration).seconds
    let tracks = try loadTracks(asset: asset)
    guard let track = tracks.first else {
        throw NSError(domain: "inspect-video", code: 2,
                      userInfo: [NSLocalizedDescriptionKey: "no video track"])
    }
    let reader = try AVAssetReader(asset: asset)
    let settings: [String: Any] = [
        kCVPixelBufferPixelFormatTypeKey as String: kCVPixelFormatType_32BGRA
    ]
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: settings)
    reader.add(output)
    guard reader.startReading() else {
        throw reader.error ?? NSError(domain: "inspect-video", code: 3)
    }
    var decodedSampleCount = 0
    while let sample = output.copyNextSampleBuffer() {
        decodedSampleCount += 1
    }
    let json = "{\"durationSeconds\": \(durationSeconds), \"decodedSampleCount\": \(decodedSampleCount), \"width\": \(track.naturalSize.width), \"height\": \(track.naturalSize.height)}"
    print(json)
}

guard let target = CommandLine.arguments.dropFirst().first else {
    FileHandle.standardError.write("usage: inspect-video <file>\n".data(using: .utf8)!)
    exit(1)
}
do {
    try inspectVideo(path: target)
} catch {
    FileHandle.standardError.write("inspect-video failed: \(error)\n".data(using: .utf8)!)
    exit(1)
}
