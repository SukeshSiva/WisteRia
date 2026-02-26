import Foundation
import FoundationModels
import Vision
import ImageIO
import PDFKit

/// A small CLI helper that reads a JSON prompt from stdin,
/// performs OCR using Vision if an image is provided,
/// generates a response using Apple's on-device Foundation Model,
/// and writes the result as JSON to stdout.

struct Request: Codable {
    let type: String? // "text" or "ocr"
    let prompt: String?
    let base64Image: String?
    let responseFormat: String? // "json" or "text"
    let mimeType: String? // e.g. "application/pdf", "image/jpeg"
}

struct Response: Codable {
    let success: Bool
    let text: String?
    let error: String?
}

func writeResponse(_ response: Response) {
    let encoder = JSONEncoder()
    if let data = try? encoder.encode(response),
       let json = String(data: data, encoding: .utf8) {
        print(json)
    } else {
        print("{\"success\":false,\"error\":\"Failed to encode response\"}")
    }
}

// Read a single line of stdin since the payload is JSON stringified on one line.
// This prevents hanging indefinitely while waiting for an EOF from the frontend.
func readStdin() -> String {
    return readLine(strippingNewline: false) ?? ""
}

func performOCR(on base64String: String) async throws -> String {
    // Strip data-URL prefix if present (e.g. "data:application/pdf;base64,...")
    let clean: String
    if let commaIdx = base64String.firstIndex(of: ",") {
        clean = String(base64String[base64String.index(after: commaIdx)...])
    } else {
        clean = base64String
    }
    // Fix base64 padding
    let padded = clean.padding(toLength: ((clean.count + 3) / 4) * 4, withPad: "=", startingAt: 0)
    guard let imageData = Data(base64Encoded: padded, options: .ignoreUnknownCharacters) else {
        throw NSError(domain: "AppleAIHelper", code: 1, userInfo: [NSLocalizedDescriptionKey: "Invalid base64 encoding"])
    }
    
    // Try PDF native text extraction first
    if let pdf = PDFDocument(data: imageData) {
        var fullText = ""
        for i in 0..<pdf.pageCount {
            if let page = pdf.page(at: i), let text = page.string {
                fullText += text + "\n"
            }
        }
        let trimmed = fullText.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty {
            return trimmed
        }
        
        // Scanned PDF: render each page via PDFKit and OCR with Vision
        var ocrResults: [String] = []
        for i in 0..<min(pdf.pageCount, 8) {
            guard let page = pdf.page(at: i) else { continue }
            let pageRect = page.bounds(for: .mediaBox)
            let scale: CGFloat = 1.5
            let renderSize = CGSize(width: pageRect.width * scale, height: pageRect.height * scale)
            guard renderSize.width > 0, renderSize.height > 0 else { continue }
            
            #if canImport(AppKit)
            let thumb = page.thumbnail(of: renderSize, for: .mediaBox)
            guard let cgImage = thumb.cgImage(forProposedRect: nil, context: nil, hints: nil) else { continue }
            #else
            continue
            #endif
            
            let pageText = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<String, Error>) in
                let request = VNRecognizeTextRequest { req, error in
                    if let error = error { continuation.resume(throwing: error); return }
                    guard let observations = req.results as? [VNRecognizedTextObservation] else {
                        continuation.resume(returning: ""); return
                    }
                    let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
                    continuation.resume(returning: text)
                }
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = true
                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                do { try handler.perform([request]) } catch { continuation.resume(throwing: error) }
            }
            if !pageText.isEmpty {
                ocrResults.append("--- Page \(i + 1) ---\n\(pageText)")
            }
        }
        
        let combined = ocrResults.joined(separator: "\n\n")
        if !combined.isEmpty { return combined }
        throw NSError(domain: "AppleAIHelper", code: 2, userInfo: [NSLocalizedDescriptionKey: "Could not extract text from PDF — document may be encrypted or blank."])
    }

    // Non-PDF image path
    guard let source = CGImageSourceCreateWithData(imageData as CFData, nil),
          let cgImage = CGImageSourceCreateImageAtIndex(source, 0, nil) else {
        throw NSError(domain: "AppleAIHelper", code: 1, userInfo: [NSLocalizedDescriptionKey: "Unsupported image format or invalid base64 data."])
    }
    
    return try await withCheckedThrowingContinuation { continuation in
        let request = VNRecognizeTextRequest { request, error in
            if let error = error {
                continuation.resume(throwing: error)
                return
            }
            guard let observations = request.results as? [VNRecognizedTextObservation] else {
                continuation.resume(returning: "")
                return
            }
            let text = observations.compactMap { $0.topCandidates(1).first?.string }.joined(separator: "\n")
            continuation.resume(returning: text)
        }
        request.recognitionLevel = .accurate
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
            try handler.perform([request])
        } catch {
            continuation.resume(throwing: error)
        }
    }
}

// Main entry point
let inputString = readStdin()

guard !inputString.isEmpty else {
    writeResponse(Response(success: false, text: nil, error: "No input provided"))
    exit(1)
}

let decoder = JSONDecoder()
guard let inputData = inputString.data(using: .utf8),
      let request = try? decoder.decode(Request.self, from: inputData) else {
    writeResponse(Response(success: false, text: nil, error: "Invalid JSON input"))
    exit(1)
}

Task {
    // Check if Apple Intelligence is available
    guard SystemLanguageModel.default.isAvailable else {
        writeResponse(Response(success: false, text: nil, error: "Apple Intelligence is not available on this device. Please enable it in System Settings > Apple Intelligence & Siri."))
        exit(1)
    }

    // Generate response using the on-device model
    do {
        let session = LanguageModelSession()
        var finalPrompt = request.prompt ?? ""
        let isPDF = request.mimeType == "application/pdf"
        let isOCR = request.type == "ocr" || isPDF
        if isOCR, let base64Image = request.base64Image {
            var extractedText = try await performOCR(on: base64Image)
            // Apple Intelligence has a small context window (~2K tokens).
            // Truncate extracted text to avoid exceeding it.
            let maxChars = 1500
            if extractedText.count > maxChars {
                extractedText = String(extractedText.prefix(maxChars)) + "\n[...truncated]"
            }
            finalPrompt += "\n\n--- EXTRACTED TEXT FROM DOCUMENT ---\n" + extractedText
        }
        
        // Output formatting instruction required for Apple AI
        if request.responseFormat == "json" && !finalPrompt.contains("Respond ONLY with the JSON") {
            finalPrompt += "\n\nRespond ONLY with the raw JSON, do not include markdown formatting."
        }
        
        let response = try await session.respond(to: finalPrompt)
        writeResponse(Response(success: true, text: response.content, error: nil))
    } catch {
        writeResponse(Response(success: false, text: nil, error: "AI generation failed: \(error.localizedDescription)"))
    }
    exit(0)
}

RunLoop.main.run()
