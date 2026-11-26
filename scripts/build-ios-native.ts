/**
 * Cross-Platform Data, Assets & Xcode Project Sync Script (`npm run sync:ios` / `npm run build:ios`)
 *
 * Architecture (P2-2 Option 1 — Shared JSON Data Contract):
 * 1. Exports `shared/game_data.json` from Web TypeScript single source of truth (`src/game/sharedGameData.ts`).
 * 2. Syncs `shared/game_data.json` + PNG/JPG art assets into `ios-native/HungrySharkEvolution/Resources/Assets/`.
 * 3. Generates `Assets.xcassets` launch catalog, `project.yml`, `Package.swift`, and validated `project.pbxproj`.
 *
 * IMPORTANT:
 * - Native Swift source files (`HungrySharkEvolutionApp.swift`, `Generated/GameConfigGenerated.swift`,
 *   `Core/GameRules.swift`, `Rendering/SpriteAtlasManager.swift`, `Rendering/OceanGameScene.swift`,
 *   `UI/ContentView.swift`, and `Info.plist`) are independent first-class Xcode source files.
 * - This script NEVER overwrites Swift source code or `Info.plist`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSharedGameData } from '../src/game/sharedGameData';
import { GOOGLE_ADS_CONFIG } from '../src/game/adManager';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SHARED_DIR = path.join(ROOT_DIR, 'shared');
const SHARED_CONFIGS_DIR = path.join(SHARED_DIR, 'configs');
const SHARED_JSON_PATH = path.join(SHARED_DIR, 'game_data.json');
const IOS_ROOT = path.join(ROOT_DIR, 'ios-native');
const APP_DIR = path.join(IOS_ROOT, 'HungrySharkEvolution');
const TESTS_DIR = path.join(IOS_ROOT, 'HungrySharkEvolutionTests');

const CANONICAL_SWIFT_FILES = [
  'HungrySharkEvolutionApp.swift',
  'Generated/GameConfigGenerated.swift',
  'Core/GameRules.swift',
  'Rendering/SpriteAtlasManager.swift',
  'Rendering/OceanGameScene.swift',
  'UI/ContentView.swift',
] as const;

function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeFileIfChanged(filePath: string, content: string): boolean {
  if (fs.existsSync(filePath)) {
    const existing = fs.readFileSync(filePath, 'utf8');
    if (existing === content) return false;
  }
  fs.writeFileSync(filePath, content, 'utf8');
  return true;
}

function copyIfChanged(src: string, dst: string): boolean {
  if (fs.existsSync(dst)) {
    const sStat = fs.statSync(src);
    const dStat = fs.statSync(dst);
    if (sStat.size === dStat.size && fs.readFileSync(src).equals(fs.readFileSync(dst))) {
      return false;
    }
  }
  fs.copyFileSync(src, dst);
  return true;
}

function discoverSwiftSourceFiles(appDir: string): string[] {
  const discovered: string[] = [];

  const walk = (currentDir: string, relPrefix: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (
        entry.name.startsWith('.') ||
        entry.name === 'Resources' ||
        entry.name === 'Assets.xcassets' ||
        entry.name.endsWith('.lproj')
      ) {
        continue;
      }
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.swift')) {
        discovered.push(relPath);
      }
    }
  };

  walk(appDir, '');

  // Preserve stable ordering for the 6 canonical Swift files, then sort any additional Xcode Swift files alphabetically.
  const canonicalSet = new Set<string>(CANONICAL_SWIFT_FILES);
  const missingCanonical = CANONICAL_SWIFT_FILES.filter((f) => !discovered.includes(f));
  if (missingCanonical.length > 0) {
    throw new Error(
      `[sync:ios] Missing required native Swift source files in ios-native/HungrySharkEvolution/: ${missingCanonical.join(', ')}. ` +
        `This script no longer generates Swift source code from TS templates.`
    );
  }

  const extras = discovered.filter((f) => !canonicalSet.has(f)).sort();
  return [...CANONICAL_SWIFT_FILES, ...extras];
}

function discoverTestSwiftFiles(testsDir: string): string[] {
  if (!fs.existsSync(testsDir)) return [];
  const discovered: string[] = [];
  const walk = (currentDir: string, relPrefix: string) => {
    for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(currentDir, entry.name);
      const relPath = relPrefix ? `${relPrefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        walk(fullPath, relPath);
      } else if (entry.isFile() && entry.name.endsWith('.swift')) {
        discovered.push(relPath);
      }
    }
  };
  walk(testsDir, '');
  return discovered.sort();
}

function generateXcodeGenProjectYml(): string {
  return `name: HungrySharkEvolution
options:
  bundleIdPrefix: com.deepsea.hungryshark
  deploymentTarget:
    iOS: "16.0"
  xcodeVersion: "15.0"
packages:
  GoogleMobileAds:
    url: https://github.com/googleads/swift-package-manager-google-mobile-ads.git
    from: 11.2.0
targets:
  HungrySharkEvolution:
    type: application
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: HungrySharkEvolution
        excludes:
          - "Resources/Assets/*.png"
          - "Resources/Assets/*.jpg"
          - "Resources/Assets/*.webp"
          - "Resources/Assets/*.json"
      - path: HungrySharkEvolution/Resources/Assets
        type: folder
        buildPhase: resources
    dependencies:
      - package: GoogleMobileAds
        product: GoogleMobileAds
    info:
      path: HungrySharkEvolution/Info.plist
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.deepsea.hungryshark.evolution
        MARKETING_VERSION: 1.0.0
        CURRENT_PROJECT_VERSION: 1
        SWIFT_VERSION: 5.9
        TARGETED_DEVICE_FAMILY: "1,2"
        OTHER_LDFLAGS: "-ObjC"
        GENERATE_INFOPLIST_FILE: YES
        INFOPLIST_FILE: HungrySharkEvolution/Info.plist
        DEVELOPMENT_TEAM: 3N2FUK7M23
        CODE_SIGN_STYLE: Automatic
        COMPRESS_PNG_FILES: NO
        STRIP_PNG_TEXT: NO
        INFOPLIST_KEY_CFBundleDisplayName: "DeepSea Evolution"
        INFOPLIST_KEY_GADApplicationIdentifier: "${GOOGLE_ADS_CONFIG.admobAppId}"
        INFOPLIST_KEY_GADIsAdManagerApp: YES
        INFOPLIST_KEY_NSUserTrackingUsageDescription: "允许追踪以提供个性化深海狩猎激励视频广告体验"
  HungrySharkEvolutionTests:
    type: bundle.unit-test
    platform: iOS
    deploymentTarget: "16.0"
    sources:
      - path: HungrySharkEvolutionTests
    dependencies:
      - target: HungrySharkEvolution
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.deepsea.hungryshark.evolutionTests
        GENERATE_INFOPLIST_FILE: YES
        SWIFT_VERSION: 5.9
`;
}

function generatePackageSwift(): string {
  return `// swift-tools-version: 5.9
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
            exclude: [
                "Info.plist",
                "HungrySharkEvolutionApp.swift",
                "PrivacyInfo.xcprivacy",
                "zh-Hans.lproj",
                "en.lproj"
            ],
            resources: [
                .copy("Resources/Assets")
            ]
        ),
        .testTarget(
            name: "HungrySharkEvolutionTests",
            dependencies: ["HungrySharkEvolutionCore"],
            path: "HungrySharkEvolutionTests"
        )
    ]
)
`;
}

function getResourceFileType(fileName: string): string {
  if (fileName.endsWith('.json')) return 'text.json';
  if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) return 'image.jpeg';
  if (fileName.endsWith('.webp')) return 'file';
  return 'image.png';
}

function generatePbxproj(swiftFiles: string[], assetFiles: string[], testSwiftFiles: string[]): string {
  // Valid Xcode 15/16 project.pbxproj referencing all discovered Swift files, Assets.xcassets,
  // PrivacyInfo.xcprivacy, bilingual InfoPlist.strings (en + zh-Hans), HungrySharkEvolutionTests,
  // GoogleMobileAds Swift Package (minimumVersion = "11.2.0"),
  // AND every individual PNG/JPG/JSON resource (including game_data.json).
  const swiftEntries = swiftFiles.map((relPath, i) => {
    const fileName = path.basename(relPath);
    const idNum = i < 6 ? i + 1 : 100 + (i - 5);
    const idxHex = String(idNum).padStart(4, '0');
    const buildId = `A100${idxHex}2B00000000000001`;
    const fileRefId = `A200${idxHex}2B00000000000001`;
    const quotedPath = relPath.includes('/') ? `"${relPath}"` : relPath;
    return { relPath, fileName, buildId, fileRefId, quotedPath };
  });

  const swiftBuildFiles = swiftEntries
    .map(
      (s) =>
        `\t\t${s.buildId} /* ${s.fileName} in Sources */ = {isa = PBXBuildFile; fileRef = ${s.fileRefId} /* ${s.fileName} */; };`
    )
    .join('\n');

  const swiftFileRefs = swiftEntries
    .map(
      (s) =>
        `\t\t${s.fileRefId} /* ${s.fileName} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${s.quotedPath}; sourceTree = "<group>"; };`
    )
    .join('\n');

  const swiftGroupChildren = swiftEntries
    .map((s) => `\t\t\t\t${s.fileRefId} /* ${s.fileName} */,`)
    .join('\n');

  const swiftSourcePhaseEntries = swiftEntries
    .map((s) => `\t\t\t\t${s.buildId} /* ${s.fileName} in Sources */,`)
    .join('\n');

  const sortedAssets = [...assetFiles]
    .map((f) => f.trim())
    .filter(
      (f) =>
        f.length > 0 &&
        (f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.json'))
    )
    .sort();

  const assetBuildFiles = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      return `\t\tB100${idxHex}2B00000000000001 /* ${f} in Resources */ = {isa = PBXBuildFile; fileRef = B200${idxHex}2B00000000000001 /* ${f} */; };`;
    })
    .join('\n');

  const assetFileRefs = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      const fileType = getResourceFileType(f);
      return `\t\tB200${idxHex}2B00000000000001 /* ${f} */ = {isa = PBXFileReference; lastKnownFileType = ${fileType}; name = "${f}"; path = "HungrySharkEvolution/Resources/Assets/${f}"; sourceTree = SOURCE_ROOT; };`;
    })
    .join('\n');

  const assetGroupChildren = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      return `\t\t\t\tB200${idxHex}2B00000000000001 /* ${f} */,`;
    })
    .join('\n');

  const assetResourceEntries = sortedAssets
    .map((f, i) => {
      const idxHex = String(i + 1).padStart(4, '0');
      return `\t\t\t\tB100${idxHex}2B00000000000001 /* ${f} in Resources */,`;
    })
    .join('\n');

  const testEntries = testSwiftFiles.map((relPath, i) => {
    const fileName = path.basename(relPath);
    const idxHex = String(i + 1).padStart(4, '0');
    const buildId = `T100${idxHex}2B00000000000001`;
    const fileRefId = `T200${idxHex}2B00000000000001`;
    const quotedPath = relPath.includes('/') ? `"${relPath}"` : relPath;
    return { relPath, fileName, buildId, fileRefId, quotedPath };
  });

  const testBuildFiles = testEntries
    .map(
      (s) =>
        `\t\t${s.buildId} /* ${s.fileName} in Sources */ = {isa = PBXBuildFile; fileRef = ${s.fileRefId} /* ${s.fileName} */; };`
    )
    .join('\n');

  const testFileRefs = testEntries
    .map(
      (s) =>
        `\t\t${s.fileRefId} /* ${s.fileName} */ = {isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = ${s.quotedPath}; sourceTree = "<group>"; };`
    )
    .join('\n');

  const testGroupChildren = testEntries
    .map((s) => `\t\t\t\t${s.fileRefId} /* ${s.fileName} */,`)
    .join('\n');

  const testSourcePhaseEntries = testEntries
    .map((s) => `\t\t\t\t${s.buildId} /* ${s.fileName} in Sources */,`)
    .join('\n');

  return `// !$*UTF8*$!
{
	archiveVersion = 1;
	classes = {
	};
	objectVersion = 56;
	objects = {

/* Begin PBXBuildFile section */
${swiftBuildFiles}
		A10000072B00000000000001 /* Assets in Resources */ = {isa = PBXBuildFile; fileRef = A20000072B00000000000001 /* Assets */; };
		A10000082B00000000000001 /* Assets.xcassets in Resources */ = {isa = PBXBuildFile; fileRef = A20000102B00000000000001 /* Assets.xcassets */; };
		A10000092B00000000000001 /* GoogleMobileAds in Frameworks */ = {isa = PBXBuildFile; productRef = A99000022B00000000000001 /* GoogleMobileAds */; };
		A100000A2B00000000000001 /* PrivacyInfo.xcprivacy in Resources */ = {isa = PBXBuildFile; fileRef = A20000112B00000000000001 /* PrivacyInfo.xcprivacy */; };
		A100000B2B00000000000001 /* InfoPlist.strings in Resources */ = {isa = PBXBuildFile; fileRef = A20000122B00000000000001 /* InfoPlist.strings */; };
${testBuildFiles}
${assetBuildFiles}
/* End PBXBuildFile section */

/* Begin PBXContainerItemProxy section */
		T70000012B00000000000001 /* PBXContainerItemProxy */ = {
			isa = PBXContainerItemProxy;
			containerPortal = A70000012B00000000000001 /* Project object */;
			proxyType = 1;
			remoteGlobalIDString = A50000012B00000000000001;
			remoteInfo = HungrySharkEvolution;
		};
/* End PBXContainerItemProxy section */

/* Begin PBXFileReference section */
		A00000012B00000000000001 /* HungrySharkEvolution.app */ = {isa = PBXFileReference; explicitFileType = wrapper.application; includeInIndex = 0; path = HungrySharkEvolution.app; sourceTree = BUILT_PRODUCTS_DIR; };
		T00000012B00000000000001 /* HungrySharkEvolutionTests.xctest */ = {isa = PBXFileReference; explicitFileType = wrapper.cfbundle; includeInIndex = 0; path = HungrySharkEvolutionTests.xctest; sourceTree = BUILT_PRODUCTS_DIR; };
${swiftFileRefs}
${testFileRefs}
		A20000072B00000000000001 /* Assets */ = {isa = PBXFileReference; lastKnownFileType = folder; path = "Resources/Assets"; sourceTree = "<group>"; };
		A20000082B00000000000001 /* Info.plist */ = {isa = PBXFileReference; lastKnownFileType = text.plist.xml; path = Info.plist; sourceTree = "<group>"; };
		A20000102B00000000000001 /* Assets.xcassets */ = {isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>"; };
		A20000112B00000000000001 /* PrivacyInfo.xcprivacy */ = {isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>"; };
		A20000132B00000000000001 /* en */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = en; path = "en.lproj/InfoPlist.strings"; sourceTree = "<group>"; };
		A20000142B00000000000001 /* zh-Hans */ = {isa = PBXFileReference; lastKnownFileType = text.plist.strings; name = "zh-Hans"; path = "zh-Hans.lproj/InfoPlist.strings"; sourceTree = "<group>"; };
${assetFileRefs}
/* End PBXFileReference section */

/* Begin PBXFrameworksBuildPhase section */
		A30000012B00000000000001 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000092B00000000000001 /* GoogleMobileAds in Frameworks */,
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		T30000012B00000000000001 /* Frameworks */ = {
			isa = PBXFrameworksBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXFrameworksBuildPhase section */

/* Begin PBXGroup section */
		A40000012B00000000000001 = {
			isa = PBXGroup;
			children = (
				A40000022B00000000000001 /* HungrySharkEvolution */,
				T40000022B00000000000001 /* HungrySharkEvolutionTests */,
				A40000032B00000000000001 /* Products */,
			);
			sourceTree = "<group>";
		};
		A40000022B00000000000001 /* HungrySharkEvolution */ = {
			isa = PBXGroup;
			children = (
${swiftGroupChildren}
				A20000102B00000000000001 /* Assets.xcassets */,
				A20000072B00000000000001 /* Assets */,
				A40000042B00000000000001 /* BundledAssets */,
				A20000112B00000000000001 /* PrivacyInfo.xcprivacy */,
				A20000122B00000000000001 /* InfoPlist.strings */,
				A20000082B00000000000001 /* Info.plist */,
			);
			path = HungrySharkEvolution;
			sourceTree = "<group>";
		};
		T40000022B00000000000001 /* HungrySharkEvolutionTests */ = {
			isa = PBXGroup;
			children = (
${testGroupChildren}
			);
			path = HungrySharkEvolutionTests;
			sourceTree = "<group>";
		};
		A40000042B00000000000001 /* BundledAssets */ = {
			isa = PBXGroup;
			children = (
${assetGroupChildren}
			);
			name = BundledAssets;
			sourceTree = "<group>";
		};
		A40000032B00000000000001 /* Products */ = {
			isa = PBXGroup;
			children = (
				A00000012B00000000000001 /* HungrySharkEvolution.app */,
				T00000012B00000000000001 /* HungrySharkEvolutionTests.xctest */,
			);
			name = Products;
			sourceTree = "<group>";
		};
/* End PBXGroup section */

/* Begin PBXNativeTarget section */
		A50000012B00000000000001 /* HungrySharkEvolution */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = A80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolution" */;
			buildPhases = (
				A60000012B00000000000001 /* Sources */,
				A30000012B00000000000001 /* Frameworks */,
				A60000022B00000000000001 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
			);
			name = HungrySharkEvolution;
			packageProductDependencies = (
				A99000022B00000000000001 /* GoogleMobileAds */,
			);
			productName = HungrySharkEvolution;
			productReference = A00000012B00000000000001 /* HungrySharkEvolution.app */;
			productType = "com.apple.product-type.application";
		};
		T50000012B00000000000001 /* HungrySharkEvolutionTests */ = {
			isa = PBXNativeTarget;
			buildConfigurationList = T80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolutionTests" */;
			buildPhases = (
				T60000012B00000000000001 /* Sources */,
				T30000012B00000000000001 /* Frameworks */,
				T60000022B00000000000001 /* Resources */,
			);
			buildRules = (
			);
			dependencies = (
				T70000022B00000000000001 /* PBXTargetDependency */,
			);
			name = HungrySharkEvolutionTests;
			productName = HungrySharkEvolutionTests;
			productReference = T00000012B00000000000001 /* HungrySharkEvolutionTests.xctest */;
			productType = "com.apple.product-type.bundle.unit-test";
		};
/* End PBXNativeTarget section */

/* Begin PBXProject section */
		A70000012B00000000000001 /* Project object */ = {
			isa = PBXProject;
			attributes = {
				BuildIndependentTargetsInParallel = 1;
				LastSwiftUpdateCheck = 1500;
				LastUpgradeCheck = 1500;
				TargetAttributes = {
					T50000012B00000000000001 = {
						TestTargetID = A50000012B00000000000001;
					};
				};
			};
			buildConfigurationList = A80000012B00000000000001 /* Build configuration list for PBXProject "HungrySharkEvolution" */;
			compatibilityVersion = "Xcode 14.0";
			developmentRegion = zh_CN;
			hasScannedForEncodings = 0;
			knownRegions = (
				en,
				zh_CN,
				"zh-Hans",
				Base,
			);
			mainGroup = A40000012B00000000000001;
			packageReferences = (
				A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */,
			);
			productRefGroup = A40000032B00000000000001 /* Products */;
			projectDirPath = "";
			projectRoot = "";
			targets = (
				A50000012B00000000000001 /* HungrySharkEvolution */,
				T50000012B00000000000001 /* HungrySharkEvolutionTests */,
			);
		};
/* End PBXProject section */

/* Begin PBXResourcesBuildPhase section */
		A60000022B00000000000001 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
				A10000082B00000000000001 /* Assets.xcassets in Resources */,
				A10000072B00000000000001 /* Assets in Resources */,
				A100000A2B00000000000001 /* PrivacyInfo.xcprivacy in Resources */,
				A100000B2B00000000000001 /* InfoPlist.strings in Resources */,
${assetResourceEntries}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		T60000022B00000000000001 /* Resources */ = {
			isa = PBXResourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXResourcesBuildPhase section */

/* Begin PBXSourcesBuildPhase section */
		A60000012B00000000000001 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
${swiftSourcePhaseEntries}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
		T60000012B00000000000001 /* Sources */ = {
			isa = PBXSourcesBuildPhase;
			buildActionMask = 2147483647;
			files = (
${testSourcePhaseEntries}
			);
			runOnlyForDeploymentPostprocessing = 0;
		};
/* End PBXSourcesBuildPhase section */

/* Begin PBXTargetDependency section */
		T70000022B00000000000001 /* PBXTargetDependency */ = {
			isa = PBXTargetDependency;
			target = A50000012B00000000000001 /* HungrySharkEvolution */;
			targetProxy = T70000012B00000000000001 /* PBXContainerItemProxy */;
		};
/* End PBXTargetDependency section */

/* Begin PBXVariantGroup section */
		A20000122B00000000000001 /* InfoPlist.strings */ = {
			isa = PBXVariantGroup;
			children = (
				A20000132B00000000000001 /* en */,
				A20000142B00000000000001 /* zh-Hans */,
			);
			name = InfoPlist.strings;
			sourceTree = "<group>";
		};
/* End PBXVariantGroup section */

/* Begin XCBuildConfiguration section */
		A90000012B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = dwarf;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				ENABLE_TESTABILITY = YES;
				GCC_DYNAMIC_NO_PIC = NO;
				GCC_OPTIMIZATION_LEVEL = 0;
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				MTL_ENABLE_DEBUG_INFO = INCLUDE_SOURCE;
				ONLY_ACTIVE_ARCH = YES;
				OTHER_LDFLAGS = "-ObjC";
				SDKROOT = iphoneos;
				SWIFT_ACTIVE_COMPILATION_CONDITIONS = DEBUG;
				SWIFT_OPTIMIZATION_LEVEL = "-Onone";
				SWIFT_VERSION = "5.0";
			};
			name = Debug;
		};
		A90000022B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ALWAYS_SEARCH_USER_PATHS = NO;
				CLANG_ENABLE_MODULES = YES;
				CLANG_ENABLE_OBJC_ARC = YES;
				COPY_PHASE_STRIP = NO;
				DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
				ENABLE_NS_ASSERTIONS = NO;
				ENABLE_STRICT_OBJC_MSGSEND = YES;
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				MTL_ENABLE_DEBUG_INFO = NO;
				OTHER_LDFLAGS = "-ObjC";
				SDKROOT = iphoneos;
				SWIFT_COMPILATION_MODE = wholemodule;
				SWIFT_OPTIMIZATION_LEVEL = "-O";
				SWIFT_VERSION = "5.0";
				VALIDATE_PRODUCT = YES;
			};
			name = Release;
		};
		A90000032B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				COMPRESS_PNG_FILES = NO;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 3N2FUK7M23;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = "HungrySharkEvolution/Info.plist";
				INFOPLIST_KEY_CFBundleDisplayName = "DeepSea Evolution";
				INFOPLIST_KEY_GADApplicationIdentifier = "${GOOGLE_ADS_CONFIG.admobAppId}";
				INFOPLIST_KEY_GADIsAdManagerApp = YES;
				INFOPLIST_KEY_NSUserTrackingUsageDescription = "Allow tracking to deliver personalized rewarded video ads.";
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				OTHER_LDFLAGS = "-ObjC";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolution";
				PRODUCT_NAME = "$(TARGET_NAME)";
				STRIP_PNG_TEXT = NO;
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = "5.0";
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Debug;
		};
		A90000042B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				ASSETCATALOG_COMPILER_APPICON_NAME = AppIcon;
				CODE_SIGN_STYLE = Automatic;
				COMPRESS_PNG_FILES = NO;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 3N2FUK7M23;
				GENERATE_INFOPLIST_FILE = YES;
				INFOPLIST_FILE = "HungrySharkEvolution/Info.plist";
				INFOPLIST_KEY_CFBundleDisplayName = "DeepSea Evolution";
				INFOPLIST_KEY_GADApplicationIdentifier = "${GOOGLE_ADS_CONFIG.admobAppId}";
				INFOPLIST_KEY_GADIsAdManagerApp = YES;
				INFOPLIST_KEY_NSUserTrackingUsageDescription = "Allow tracking to deliver personalized rewarded video ads.";
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				OTHER_LDFLAGS = "-ObjC";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolution";
				PRODUCT_NAME = "$(TARGET_NAME)";
				STRIP_PNG_TEXT = NO;
				SWIFT_EMIT_LOC_STRINGS = YES;
				SWIFT_VERSION = "5.0";
				TARGETED_DEVICE_FAMILY = "1,2";
			};
			name = Release;
		};
		T90000032B00000000000001 /* Debug */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 3N2FUK7M23;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@loader_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolutionTests";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = NO;
				SWIFT_VERSION = "5.0";
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/HungrySharkEvolution.app/HungrySharkEvolution";
			};
			name = Debug;
		};
		T90000042B00000000000001 /* Release */ = {
			isa = XCBuildConfiguration;
			buildSettings = {
				BUNDLE_LOADER = "$(TEST_HOST)";
				CODE_SIGN_STYLE = Automatic;
				CURRENT_PROJECT_VERSION = 1;
				DEVELOPMENT_TEAM = 3N2FUK7M23;
				GENERATE_INFOPLIST_FILE = YES;
				IPHONEOS_DEPLOYMENT_TARGET = "16.0";
				LD_RUNPATH_SEARCH_PATHS = (
					"$(inherited)",
					"@executable_path/Frameworks",
					"@loader_path/Frameworks",
				);
				MARKETING_VERSION = "1.0.0";
				PRODUCT_BUNDLE_IDENTIFIER = "com.deepsea.hungryshark.evolutionTests";
				PRODUCT_NAME = "$(TARGET_NAME)";
				SWIFT_EMIT_LOC_STRINGS = NO;
				SWIFT_VERSION = "5.0";
				TARGETED_DEVICE_FAMILY = "1,2";
				TEST_HOST = "$(BUILT_PRODUCTS_DIR)/HungrySharkEvolution.app/HungrySharkEvolution";
			};
			name = Release;
		};
/* End XCBuildConfiguration section */

/* Begin XCConfigurationList section */
		A80000012B00000000000001 /* Build configuration list for PBXProject "HungrySharkEvolution" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A90000012B00000000000001 /* Debug */,
				A90000022B00000000000001 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		A80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolution" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				A90000032B00000000000001 /* Debug */,
				A90000042B00000000000001 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
		T80000022B00000000000001 /* Build configuration list for PBXNativeTarget "HungrySharkEvolutionTests" */ = {
			isa = XCConfigurationList;
			buildConfigurations = (
				T90000032B00000000000001 /* Debug */,
				T90000042B00000000000001 /* Release */,
			);
			defaultConfigurationIsVisible = 0;
			defaultConfigurationName = Release;
		};
/* End XCConfigurationList section */

/* Begin XCRemoteSwiftPackageReference section */
		A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */ = {
			isa = XCRemoteSwiftPackageReference;
			repositoryURL = "https://github.com/googleads/swift-package-manager-google-mobile-ads.git";
			requirement = {
				kind = upToNextMajorVersion;
				minimumVersion = "11.2.0";
			};
		};
/* End XCRemoteSwiftPackageReference section */

/* Begin XCSwiftPackageProductDependency section */
		A99000022B00000000000001 /* GoogleMobileAds */ = {
			isa = XCSwiftPackageProductDependency;
			package = A99000012B00000000000001 /* XCRemoteSwiftPackageReference "swift-package-manager-google-mobile-ads" */;
			productName = GoogleMobileAds;
		};
/* End XCSwiftPackageProductDependency section */
	};
	rootObject = A70000012B00000000000001 /* Project object */;
}
`;
}

/**
 * Validates that the generated project.pbxproj strictly conforms to Xcode's OpenStep PropertyList grammar:
 * 1. Pure ASCII only (prevents CFPropertyList encoding rejections).
 * 2. No unquoted multi-dot version numbers (e.g. minimumVersion = 11.2.0; or MARKETING_VERSION = 1.0.0;).
 * 3. No empty array elements / stray commas / balanced braces & parentheses.
 */
function validateOpenStepPbxproj(pbx: string): void {
  for (let i = 0; i < pbx.length; i++) {
    const code = pbx.charCodeAt(i);
    if (code > 127) {
      throw new Error(
        `[sync:ios] OpenStep Plist validation failed: Non-ASCII character (code ${code}) at offset ${i}`
      );
    }
  }
  const stripped = pbx.replace(/\/\*[\s\S]*?\*\//g, '');
  if (/=\s*\d+\.\d+\.\d+\s*;/.test(stripped)) {
    throw new Error(
      `[sync:ios] OpenStep Plist validation failed: Unquoted semantic version detected in project.pbxproj`
    );
  }
  if (/,\s*,/.test(stripped) || /\(\s*,/.test(stripped)) {
    throw new Error(
      `[sync:ios] OpenStep Plist validation failed: Empty array item / stray comma detected in project.pbxproj`
    );
  }
  let braceDepth = 0;
  let parenDepth = 0;
  let inQuotes = false;
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (ch === '"' && stripped[i - 1] !== '\\') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '(') parenDepth++;
      else if (ch === ')') parenDepth--;
      if (braceDepth < 0 || parenDepth < 0) {
        throw new Error(
          `[sync:ios] OpenStep Plist validation failed: Unbalanced delimiter at offset ${i}`
        );
      }
    }
  }
  if (inQuotes || braceDepth !== 0 || parenDepth !== 0) {
    throw new Error(
      `[sync:ios] OpenStep Plist validation failed: Unclosed quotes or delimiters (brace=${braceDepth}, paren=${parenDepth})`
    );
  }
}

function generateLaunchAssetsCatalog(appDir: string, srcAssetsDir: string): void {
  const xcassetsDir = path.join(appDir, 'Assets.xcassets');
  const appIconDir = path.join(xcassetsDir, 'AppIcon.appiconset');
  const launchBgDir = path.join(xcassetsDir, 'LaunchBg.colorset');
  const launchLogoDir = path.join(xcassetsDir, 'LaunchLogo.imageset');
  ensureDir(appIconDir);
  ensureDir(launchBgDir);
  ensureDir(launchLogoDir);

  writeFileIfChanged(
    path.join(xcassetsDir, 'Contents.json'),
    JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2) + '\n'
  );

  const iconCandidates = [
    path.join(srcAssetsDir, 'app_icon_1024.png'),
    path.join(srcAssetsDir, 'loading_mascot.png'),
  ];
  for (const candidate of iconCandidates) {
    if (fs.existsSync(candidate)) {
      copyIfChanged(candidate, path.join(appIconDir, 'AppIcon.png'));
      break;
    }
  }
  writeFileIfChanged(
    path.join(appIconDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          {
            filename: 'AppIcon.png',
            idiom: 'universal',
            platform: 'ios',
            size: '1024x1024',
          },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2
    ) + '\n'
  );

  writeFileIfChanged(
    path.join(launchBgDir, 'Contents.json'),
    JSON.stringify(
      {
        colors: [
          {
            color: {
              'color-space': 'srgb',
              components: { alpha: '1.000', blue: '0x28', green: '0x15', red: '0x06' },
            },
            idiom: 'universal',
          },
          {
            appearances: [{ appearance: 'luminosity', value: 'dark' }],
            color: {
              'color-space': 'srgb',
              components: { alpha: '1.000', blue: '0x28', green: '0x15', red: '0x06' },
            },
            idiom: 'universal',
          },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2
    ) + '\n'
  );

  const iosBundledAssetsDir = path.join(appDir, 'Resources', 'Assets');
  const logoCandidates = [
    path.join(srcAssetsDir, 'loading_logo.png'),
    path.join(srcAssetsDir, 'title3_cae0290c.png'),
    path.join(iosBundledAssetsDir, 'loading_logo.png'),
    path.join(iosBundledAssetsDir, 'title3_cae0290c.png'),
  ];
  for (const candidate of logoCandidates) {
    if (fs.existsSync(candidate)) {
      copyIfChanged(candidate, path.join(launchLogoDir, 'loading_logo.png'));
      break;
    }
  }

  writeFileIfChanged(
    path.join(launchLogoDir, 'Contents.json'),
    JSON.stringify(
      {
        images: [
          { filename: 'loading_logo.png', idiom: 'universal', scale: '1x' },
          { idiom: 'universal', scale: '2x' },
          { idiom: 'universal', scale: '3x' },
        ],
        info: { author: 'xcode', version: 1 },
      },
      null,
      2
    ) + '\n'
  );
}

function main(): void {
  ensureDir(SHARED_DIR);
  const assetsDst = path.join(APP_DIR, 'Resources', 'Assets');
  ensureDir(assetsDst);
  const xcodeprojDir = path.join(IOS_ROOT, 'HungrySharkEvolution.xcodeproj');
  const xcworkspaceDir = path.join(xcodeprojDir, 'project.xcworkspace');
  ensureDir(xcodeprojDir);
  ensureDir(xcworkspaceDir);

  // Verify native Info.plist and Swift files exist (NEVER overwrite Swift code!)
  if (!fs.existsSync(path.join(APP_DIR, 'Info.plist'))) {
    throw new Error('[sync:ios] Missing ios-native/HungrySharkEvolution/Info.plist.');
  }
  const swiftFiles = discoverSwiftSourceFiles(APP_DIR);
  const testSwiftFiles = discoverTestSwiftFiles(TESTS_DIR);

  // Clean stale Xcode user session caches (xcuserdata)
  for (const staleUserDir of [
    path.join(xcodeprojDir, 'xcuserdata'),
    path.join(xcworkspaceDir, 'xcuserdata'),
  ]) {
    if (fs.existsSync(staleUserDir)) {
      fs.rmSync(staleUserDir, { recursive: true, force: true });
    }
  }

  writeFileIfChanged(
    path.join(xcworkspaceDir, 'contents.xcworkspacedata'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<Workspace\n   version = "1.0">\n   <FileRef\n      location = "self:">\n   </FileRef>\n</Workspace>\n`
  );

  // 1. Export cross-platform Shared JSON Data Contract (`shared/game_data.json` & `shared/configs/*.json` -> iOS Resources/Assets/)
  const payload = buildSharedGameData();
  const jsonContent = JSON.stringify(payload, null, 2) + '\n';
  writeFileIfChanged(SHARED_JSON_PATH, jsonContent);
  copyIfChanged(SHARED_JSON_PATH, path.join(assetsDst, 'game_data.json'));

  const expectedAssetFiles = new Set<string>([
    'game_data.json',
    // iOS-native hot-replaceable startup loading screen assets (preserved if present)
    'loading_background.png',
    'loading_logo.png',
    'loading_mascot.png',
  ]);

  if (fs.existsSync(SHARED_CONFIGS_DIR)) {
    for (const cfgFile of fs.readdirSync(SHARED_CONFIGS_DIR)) {
      if (!cfgFile.endsWith('.json')) continue;
      copyIfChanged(path.join(SHARED_CONFIGS_DIR, cfgFile), path.join(assetsDst, cfgFile));
      expectedAssetFiles.add(cfgFile);
    }
  }

  // 2. Sync compact WebP/PNG/JPG art assets (aistudio, 48 @3x sharks, 135 @3x prey + cyber_mine) & Launch Assets.xcassets
  // iOS 16+ ImageIO natively decodes WebP, shrinking Resources/Assets from ~61MB legacy PNGs to ~6MB.
  const srcAssetsDir = path.join(ROOT_DIR, 'public', 'assets', 'aistudio');
  generateLaunchAssetsCatalog(APP_DIR, srcAssetsDir);

  let syncedImageCount = 0;
  const syncAssetDir = (
    dirPath: string,
    predicate: (fileName: string) => boolean
  ): void => {
    if (!fs.existsSync(dirPath)) return;
    for (const file of fs.readdirSync(dirPath)) {
      if (!predicate(file)) continue;
      copyIfChanged(path.join(dirPath, file), path.join(assetsDst, file));
      expectedAssetFiles.add(file);
      syncedImageCount++;
    }
  };

  syncAssetDir(
    srcAssetsDir,
    (f) => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')
  );
  syncAssetDir(
    path.join(ROOT_DIR, 'public', 'assets', 'sharks_3x'),
    (f) => f.endsWith('.webp') || f.endsWith('.png')
  );
  syncAssetDir(
    path.join(ROOT_DIR, 'public', 'assets', 'prey_140'),
    (f) => f.endsWith('@3x.webp') || f.endsWith('@3x.png')
  );

  // Prune obsolete legacy sprite sheets (sharks_ec921c3b, fish_24bdaa5a, fish2_fc857cfa),
  // retired non-fish prey, unused parallax PNGs, and stale PNG duplicates replaced by WebP.
  let prunedCount = 0;
  for (const existing of fs.readdirSync(assetsDst)) {
    if (!expectedAssetFiles.has(existing)) {
      fs.rmSync(path.join(assetsDst, existing), { force: true });
      prunedCount++;
    }
  }

  // 3. Refresh XcodeGen spec, Package.swift, and validated project.pbxproj
  writeFileIfChanged(path.join(IOS_ROOT, 'project.yml'), generateXcodeGenProjectYml());
  writeFileIfChanged(path.join(IOS_ROOT, 'Package.swift'), generatePackageSwift());

  const allBundledAssetFiles = fs
    .readdirSync(assetsDst)
    .filter(
      (f) => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.json')
    );
  const pbxprojContent = generatePbxproj(swiftFiles, allBundledAssetFiles, testSwiftFiles);
  validateOpenStepPbxproj(pbxprojContent);
  writeFileIfChanged(path.join(xcodeprojDir, 'project.pbxproj'), pbxprojContent);

  try {
    const now = new Date();
    fs.utimesSync(assetsDst, now, now);
  } catch {
    // ignore utimes errors on read-only mounts
  }

  console.log(
    `[sync:ios] ✅ Exported shared/game_data.json (schema v${payload.schemaVersion}: ${payload.sharkForms.length} sharks, ${payload.preyTiers.length} prey, ${Object.keys(payload.i18n.zh).length} i18n keys)`
  );
  console.log(
    `[sync:ios] ✅ Synced ${syncedImageCount} WebP/PNG/JPG assets + game_data.json into ios-native/HungrySharkEvolution/Resources/Assets/ (pruned ${prunedCount} obsolete legacy files)`
  );
  console.log(
    `[sync:ios] ✅ Updated project.pbxproj (${swiftFiles.length} app Swift sources, ${testSwiftFiles.length} test sources, ${allBundledAssetFiles.length} bundled resources)`
  );
  process.exit(0);
}

main();
