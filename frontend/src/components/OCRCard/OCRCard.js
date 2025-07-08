import { useContext, useState } from "react";
import { useSnackbar } from "notistack";
import { Typography, Grid, CircularProgress } from "@mui/material";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from "@mui/material";

import { useStyles } from "./styles";
import ButtonOutlined from "../StyledComponents/ButtonOutlined";
import httpRequest from "../../httpRequest";
import OCRContext from "../../context/ocr-context";
import { COLORS } from "../../styles/constants";

const OCRCard = () => {
  const classes = useStyles();
  const ocrCtx = useContext(OCRContext);
  const [gst, setGst] = useState(null);
  const [cst, setCst] = useState(null);
  const [totalWithTax, setTotalWithTax] = useState(null);
  const [itemGstList, setItemGstList] = useState([]);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const handleOCRmethod = async (OCRmethod) => {
    setLoading(true);

    let formData = new FormData();
    formData.append("file", ocrCtx.actualImage);

    const fileType = ocrCtx.file?.type;
    if (fileType?.includes("pdf")) formData.append("pdf", ocrCtx.file);
    else formData.append("image", ocrCtx.file);

    try {
      const startTime = performance.now();
      const resp = await httpRequest.post(
        `${process.env.REACT_APP_BACKEND_URL}/${OCRmethod}`,
        formData,
        { withCredentials: true }
      );

      const endTime = performance.now();
      const duration = (endTime - startTime) / 1000;
      const time_other = duration - resp.data.time.recognition + resp.data.time.parsing;

      const time = resp.data.time;
      time["other"] = time_other;

      ocrCtx.setTextResult(resp.data.text);
      const isInvoice = checkIfInvoice(resp.data);
      const extractedData = {
        ...resp.data.parsed_data,
        id: resp.data.invoice_id,
      };
      ocrCtx.setExtractedData(extractedData);
      ocrCtx.setInvoiceId(resp.data.invoice_id);

      setGst(resp.data.gst);
      setCst(resp.data.cst);

      const total = parseFloat(resp.data.total_price || 0);
      setTotalWithTax((total + resp.data.gst + resp.data.cst).toFixed(2));

      setItemGstList(resp.data.item_gst_list || []);

      if (isInvoice) {
        saveTimeOther(resp.data.invoice_id, time_other);
      }
    } catch (error) {
      console.log("Error", error);
      enqueueSnackbar("Error", { variant: "error" });
    }

    setLoading(false);
    ocrCtx.setActivePage(3);
  };

  const checkIfInvoice = (data) => {
    const parsed = data.parsed_data;
    const requiredFields = [
      "invoice_number",
      "var_symbol",
      "total_price",
      "due_date",
      "iban",
      "buyer_ico",
      "supplier_ico",
      "bank",
    ];
    const isInvoice = requiredFields.some((field) => parsed[field] !== "");
    ocrCtx.setIsInvoice(isInvoice);
    return isInvoice;
  };

  const saveTimeOther = async (invoice_id, time_other) => {
    try {
      await httpRequest.post(
        `${process.env.REACT_APP_BACKEND_URL}/save-time-other`,
        { invoice_id, time_other },
        { withCredentials: true }
      );
    } catch (error) {
      console.log("Error", error);
      enqueueSnackbar("Error", { variant: "error" });
    }
  };

  return (
    <div className={classes.rootContainer}>
      <Typography variant="h5" sx={{ pt: 2 }}>
        Select OCR
      </Typography>

      <Grid container spacing={0} sx={{ mt: "15px" }}>
        <Grid item xs={6}>
          <ButtonOutlined
            onClick={() => handleOCRmethod("tesseract")}
            style={{ padding: "6px 18px" }}
            disabled={loading}
          >
            Tesseract
          </ButtonOutlined>
        </Grid>
        <Grid item xs={6}>
          <ButtonOutlined
            variant="outlined"
            onClick={() => handleOCRmethod("paddleOCR")}
            style={{ padding: "6px 18px" }}
            disabled={loading}
          >
            PaddleOCR
          </ButtonOutlined>
        </Grid>
      </Grid>

      {loading && (
        <CircularProgress sx={{ color: COLORS.PRIMARY, mt: "15px" }} />
      )}

      {gst !== null && cst !== null && (
        <div style={{ marginTop: "20px" }}>
          <Typography variant="body1">
            <strong>GST:</strong> ₹{gst}
          </Typography>
          <Typography variant="body1">
            <strong>CST:</strong> ₹{cst}
          </Typography>

          {totalWithTax !== null && (
            <>
              <Typography variant="body1">
                <strong>Total with Tax:</strong> ₹{totalWithTax}
              </Typography>

              {itemGstList.length > 0 && (
                <TableContainer component={Paper} sx={{ mt: 3 }}>
                  <Typography variant="h6" sx={{ p: 2 }}>
                    Item-wise GST Breakdown
                  </Typography>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell><strong>Item</strong></TableCell>
                        <TableCell><strong>HSN</strong></TableCell>
                        <TableCell><strong>Quantity</strong></TableCell>
                        <TableCell><strong>Rate</strong></TableCell>
                        <TableCell><strong>CGST %</strong></TableCell>
                        <TableCell><strong>SGST %</strong></TableCell>
                        <TableCell><strong>CGST Amt</strong></TableCell>
                        <TableCell><strong>Total</strong></TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {itemGstList.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>{item.name || "-"}</TableCell>
                          <TableCell>{item.HSN || "-"}</TableCell>
                          <TableCell>{item.Quantity || "-"}</TableCell>
                          <TableCell>{item.Rate || "-"}</TableCell>
                          <TableCell>{item.CGST_Rate || "-"}</TableCell>
                          <TableCell>{item.SGST_Rate || "-"}</TableCell>
                          <TableCell>{item.CGST_Amount || "-"}</TableCell>
                          <TableCell>{item.Amount || "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default OCRCard;
