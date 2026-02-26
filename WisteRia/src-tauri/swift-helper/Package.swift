// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "AppleAIHelper",
    platforms: [.macOS(.v26)],
    targets: [
        .executableTarget(
            name: "apple-ai-helper",
            path: "Sources"
        )
    ]
)
