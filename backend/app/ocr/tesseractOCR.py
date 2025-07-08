from flask import Blueprint, jsonify
import time
import pytesseract
import re

from app.parsers.tesseractParser import parse_text
from app.utils.operations import add_invoice_to_db, check_if_invoice, compute_confidence
from app.utils.utils import load_image, get_files_from_request
from app.config import INVOICE_LANG

pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
tesseract_bp = Blueprint('tesseract', __name__)

@tesseract_bp.route('/tesseract', methods=['POST'])
def process_tesseract():
    img = load_image()
    ocr_method = 'Tesseract'

    # OCR
    start_time_recognition = time.time()
    text = pytesseract.image_to_string(img, lang=INVOICE_LANG)
    data = pytesseract.image_to_data(img, lang=INVOICE_LANG, output_type="dict")
    recognition_time = time.time() - start_time_recognition
    average_confidence = compute_confidence(data)

    # Parse structured fields
    start_time_parsing = time.time()
    parsed_data = parse_text(text)
    parsing_time = time.time() - start_time_parsing

    # Tax Calculation Setup
    gst_rate = 0.06  # 6% CGST
    cst_rate = 0.06  # 6% SGST
    item_gst_list = []
    total_gst = 0.0
    total_cst = 0.0

    # Regex to extract item lines (example: name qty rate)
    item_pattern = re.compile(r"([A-Z\s()]+)\s+(\d+(?:\.\d+)?)\s*(?:pkt|pcs)?\s+(\d+(?:\.\d+)?)", re.IGNORECASE)

    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue

        match = item_pattern.search(line)
        if match:
            name = match.group(1).strip()
            qty = float(match.group(2))
            rate = float(match.group(3))
            price = qty * rate
            gst = price * gst_rate
            cst = price * cst_rate

            total_gst += gst
            total_cst += cst

            item_gst_list.append({
                "name": name,
                "price": round(price, 2),
                "gst": round(gst, 2)
            })

    # Prepare response
    response = {
        "text": text,
        "parsed_data": parsed_data,
        "time": {
            "recognition": recognition_time,
            "parsing": parsing_time,
        },
        "average_confidence": average_confidence,
        "gst": round(total_gst, 2),
        "cst": round(total_cst, 2),
        "item_gst_list": item_gst_list
    }

    # DB insert if invoice-like
    if check_if_invoice(parsed_data):
        pdf_file, image_file = get_files_from_request()
        invoice_id = add_invoice_to_db(
            parsed_data, text, pdf_file, image_file,
            average_confidence, recognition_time, parsing_time, ocr_method
        )
        response["invoice_id"] = invoice_id

    return jsonify(response)
