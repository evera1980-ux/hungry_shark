// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "HungrySharkEvolution",
    platforms: [
        .iOS(.v16),
        .macOS(.v13)
    ],
    products: [
        .library(
            name: "HungrySharkEvolutionCore",
            targets: ["HungrySharkEvolutionCore"]
        )
    ],
    dependencies: [
        .package(url: "https://github.com/googleads/swift-package-manager-google-mobile-ads.git", from: "11.2.0")
    ],
    targets: [
        .target(
            name: "HungrySharkEvolutionCore",
            dependencies: [
                .product(name: "GoogleMobileAds", package: "swift-package-manager-google-mobile-ads", condition: .when(platforms: [.iOS]))
            ],
            path: "HungrySharkEvolution",
            exclude: ["Info.plist", "HungrySharkEvolutionApp.swift"],
            resources: [
                .copy("Resources/Assets")
            ]
        )
    ]
)
