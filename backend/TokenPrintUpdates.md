## Print Token Updates

### Overview

The recent updates to the print token functionality in `CustomerManagement.tsx` are focused on improving compatibility with 58mm receipt printers. These changes ensure that printed tokens maintain a professional appearance while being correctly formatted for small receipt paper.

### Objectives

1. **Ensure proper formatting for 58mm receipt paper.**
2. **Enhance the readability and appearance of the printed token.**
3. **Provide a consistent printing experience across different browsers and printers.**

### Key Changes

1. **Styling Modifications**  
   - The `@media print` CSS rules now explicitly set the page size to `58mm` by `120mm`, which ensures predictable output suitable for receipt printers.

2. **Updated Print Media Queries**  
   - Page size set to `58mm 120mm` to match receipt paper.
   - Margins reduced to `1mm` to optimize space.
   - Body width set to `56mm` to account for margins, with padding of `1mm`.
   - Font size decreased to `8pt` for optimal visibility on smaller paper.
   - Line height adjusted to `1.2` for clear and readable print.

3. **Design Improvements**  
   - Consolidated font styles including adjustments to weight, size, and line spacing for improved print clarity.
   - Ensured better color adjustments with `-webkit-print-color-adjust` and `print-color-adjust` properties set to `exact`.

4. **User Experience Enhancements**  
   - The print formatting now accounts for thermal paper constraints, allowing for clean and professional-looking tokens. This adjustment should alleviate issues previously experienced with scaling or paper-trimming in print previews.

### Benefits

- **Consistent Output**: Specifying exact dimensions and styling provides a reliable printing experience.
- **Enhanced Professional Appearance**: Even on small-scale prints, the enhanced styles maintain the intended design aesthetic.
- **Printer Compatibility**: Ensures that the token is printed correctly on various receipt printer devices without manual scaling.

### Conclusion

The updates make the process of printing customer tokens more aligned with the operational needs of businesses using receipt printers. These changes promote both practicality and aesthetics, aligning printed outputs with brand standards.
