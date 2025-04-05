import React, { useState, useRef } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import jsPDF from 'jspdf';
import VoiceInput from './VoiceInput';
import './styles/VoiceInput.css';

interface ItemInput {
  itemName: string;
  brand: string;
  quantity: string;
  unit: string;
  priority: string;
  description: string;
  details: string;
}

interface FormInputs {
  customerName: string;
  favoriteShop: string;
  billNumber: string;
  items: Array<{
    priority: string;
    itemName: string;
    brand: string;
    quantity: string;
    unit: string;
    description: string;
    details: string;
  }>;
}

const emptyItem: ItemInput = {
  itemName: '',
  brand: '',
  quantity: '',
  unit: '',
  priority: '',
  description: '',
  details: ''
};

const App: React.FC = () => {
  const [showThankYou, setShowThankYou] = useState(false);
  const lastSpokenText = useRef('');
  
  const { register, control, handleSubmit, reset, setValue, getValues } = useForm<FormInputs>({
    defaultValues: {
      customerName: '',
      favoriteShop: '',
      billNumber: '',
      items: [emptyItem]
    }
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "items"
  });

  const analyzeDescription = async (index: number) => {
    const description = getValues(`items.${index}.description`);
    if (!description) {
      alert('Please fill in the description first');
      return;
    }

    try {
      // Get the base URL from the current window location
      const baseUrl = window.location.origin;
      const response = await fetch(`${baseUrl}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: description }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('Analysis result:', result); // Debug log

      // Only update fields if they have values
      if (result.itemName) setValue(`items.${index}.itemName`, result.itemName);
      if (result.brand) setValue(`items.${index}.brand`, result.brand);
      if (result.quantity) setValue(`items.${index}.quantity`, result.quantity);
      if (result.unit) setValue(`items.${index}.unit`, result.unit);
      if (result.details) setValue(`items.${index}.details`, result.details);
      
      // Handle priority with exact case matching
      if (result.priority) {
        // Ensure priority matches the select options case exactly
        const priorityValue = result.priority.toUpperCase(); // Convert to uppercase to match select options
        console.log('Setting priority:', priorityValue); // Debug log
        if (['HIGH', 'MEDIUM', 'LOW'].includes(priorityValue)) {
          setValue(`items.${index}.priority`, priorityValue);
        } else {
          console.log('Invalid priority value:', priorityValue); // Debug log
        }
      } else {
        console.log('No priority value in result'); // Debug log
      }
      
      // Always preserve the original description
      setValue(`items.${index}.description`, description);
    } catch (error) {
      console.error('Error analyzing description:', error);
      alert('Failed to analyze the description. Please try again.');
    }
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    let y = 20; // Start higher on the page

    // Add centered title with exact blue color
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(28, 69, 135);
    const title = 'Customer Shopping List';
    const titleWidth = doc.getStringUnitWidth(title) * doc.getFontSize() / doc.internal.scaleFactor;
    doc.text(title, (pageWidth - titleWidth) / 2, y);
    y += 15;

    // Add customer details with proper spacing
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    
    // Format date in IST
    const currentDate = new Date();
    const istOptions: Intl.DateTimeFormatOptions = { 
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    };
    const formattedDate = currentDate.toLocaleString('en-IN', istOptions);
    
    const billNumber = `BILL-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
    
    const detailsX = 20;
    doc.text(`Bill Number: ${billNumber}`, detailsX, y);
    y += 15;
    doc.text(`Date: ${formattedDate} IST`, detailsX, y);
    y += 15;
    doc.text(`Customer Name: ${getValues('customerName')}`, detailsX, y);
    y += 15;
    doc.text(`Favorite Shop: ${getValues('favoriteShop')}`, detailsX, y);
    y += 20;

    // Table settings
    const startX = 20;
    const endX = pageWidth - 20;
    const tableWidth = endX - startX;
    const headerHeight = 12;
    const rowHeight = 12;

    // Define column widths
    const columns = [
      { header: '#', width: tableWidth * 0.05 },
      { header: 'Item Name', width: tableWidth * 0.2 },
      { header: 'Brand', width: tableWidth * 0.15 },
      { header: 'Quantity', width: tableWidth * 0.1 },
      { header: 'Unit', width: tableWidth * 0.1 },
      { header: 'Priority', width: tableWidth * 0.15 },
      { header: 'Details', width: tableWidth * 0.25 }
    ];

    // Draw table header with navy blue background
    doc.setFillColor(25, 65, 133);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);

    // First draw the full header background
    doc.rect(startX, y, tableWidth, headerHeight, 'F');

    // Then draw the header cells and text
    let currentX = startX;
    columns.forEach(column => {
      // Draw cell borders
      doc.setDrawColor(255, 255, 255); // White borders
      doc.rect(currentX, y, column.width, headerHeight);
      
      // Add header text
      const text = column.header;
      const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize() / doc.internal.scaleFactor;
      const textX = currentX + (column.width - textWidth) / 2;
      doc.text(text, textX, y + 8.5);
      
      currentX += column.width;
    });

    // Reset colors for content
    doc.setDrawColor(0, 0, 0); // Reset to black for remaining borders
    y += headerHeight;

    // Add table content
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);

    fields.forEach((_, index) => {
      currentX = startX;
      const rowData = [
        (index + 1).toString(),
        getValues(`items.${index}.itemName`) || '',
        getValues(`items.${index}.brand`) || '',
        getValues(`items.${index}.quantity`) || '',
        getValues(`items.${index}.unit`) || '',
        getValues(`items.${index}.priority`) || '',
        getValues(`items.${index}.details`) || ''
      ];

      // Calculate required height for details column
      const detailsText = rowData[6];
      const detailsWidth = columns[6].width - 6;
      const lines = doc.splitTextToSize(detailsText, detailsWidth);
      const requiredHeight = Math.max(rowHeight, lines.length * 6);

      // Check if we need to add a new page
      if (y + requiredHeight > pageHeight - 20) {
        doc.addPage();
        y = 20;
      }

      // Draw row
      columns.forEach((column, colIndex) => {
        // Draw cell border
        doc.rect(currentX, y, column.width, requiredHeight);
        
        const text = rowData[colIndex];
        if (colIndex === 0) {
          // Center align the serial number
          const textWidth = doc.getStringUnitWidth(text) * doc.getFontSize() / doc.internal.scaleFactor;
          const textX = currentX + (column.width - textWidth) / 2;
          doc.text(text, textX, y + 7);
        } else if (colIndex === 6) {
          // Handle details column with wrapping
          doc.text(lines, currentX + 3, y + 7);
        } else {
          // Left align other cells with padding
          doc.text(text, currentX + 3, y + 7);
        }
        
        currentX += column.width;
      });
      y += requiredHeight;
    });

    // Save the PDF
    doc.save(`${billNumber}.pdf`);
  };

  const onSubmit = async (data: FormInputs) => {
    try {
      // Generate bill number
      const currentDate = new Date();
      const billNumber = `BILL-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${Math.floor(Math.random() * 10000)}`;
      
      // Add bill number to the data
      const dataWithBillNumber = {
        ...data,
        billNumber
      };

      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataWithBillNumber),
      });

      if (response.ok) {
        generatePDF();  // Generate PDF after successful submission
        setShowThankYou(true);
      } else {
        const errorData = await response.json();
        console.error('Submission failed:', errorData);
        alert('Failed to submit the form. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      alert('An error occurred while submitting the form. Please try again.');
    }
  };

  const createNewList = () => {
    reset({
      customerName: '',
      favoriteShop: '',
      items: [emptyItem]
    });
    setShowThankYou(false);
  };

  const handleTranscript = (text: string) => {
    lastSpokenText.current = text;
    setValue(`items.${fields.length - 1}.description`, text);
  };

  if (showThankYou) {
    return (
      <div className="thank-you">
        <h2>Thank you for your submission!</h2>
        <button onClick={createNewList}>Create New List</button>
      </div>
    );
  }

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="customer-details">
          <input
            {...register('customerName', { required: true })}
            className="form-control"
            placeholder="Customer Name *"
            required
          />
          <input
            {...register('favoriteShop', { required: true })}
            className="form-control"
            placeholder="Favorite Shop *"
            required
          />
        </div>

        <div className="items-container">
          {fields.map((field, index) => (
            <div key={field.id} className="item-container">
              <div className="item-header">
                <h3>Item {index + 1}</h3>
              </div>

              <div className="form-row">
                <div className="description-container">
                  <textarea
                    {...register(`items.${index}.description`)}
                    placeholder="Text Analyzer (or use voice input).Ex:1 litre milk from Farm Fresh with medium priority and  Ensure they are fresh."
                    className="description-input"
                  />
                  <div className="button-container">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        analyzeDescription(index);
                      }}
                      className="analyze-button"
                    >
                      Analyze
                    </button>
                    <div 
                      className="voice-input-container"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      onMouseUp={(e) => e.stopPropagation()}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={(e) => e.stopPropagation()}
                      onTouchStart={(e) => e.stopPropagation()}
                      onTouchEnd={(e) => e.stopPropagation()}
                    >
                      <VoiceInput
                        onTextReceived={handleTranscript}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.itemName`)}
                  placeholder="Item Name"
                  className="item-name-input"
                />
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.brand`)}
                  placeholder="Brand"
                  className="brand-input"
                />
              </div>

              <div className="form-row quantity-unit">
                <input
                  {...register(`items.${index}.quantity`)}
                  placeholder="Quantity"
                  className="quantity-input"
                />
                <select {...register(`items.${index}.unit`)} className="unit-select">
                  <option value="">Select Unit</option>
                  <option value="kg">kg</option>
                  <option value="g">g</option>
                  <option value="l">l</option>
                  <option value="ml">ml</option>
                  <option value="pcs">pcs</option>
                  <option value="dozen">dozen</option>
                  <option value="packet">packet</option>
                  <option value="box">box</option>
                </select>
              </div>

              <div className="form-row">
                <select {...register(`items.${index}.priority`)} className="priority-select">
                  <option value="">Select Priority</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>

              <div className="form-row">
                <input
                  {...register(`items.${index}.details`)}
                  placeholder="Additional Details"
                  className="details-input"
                />
              </div>

              {fields.length > 1 && (
                <button
                  type="button"
                  className="remove-button"
                  onClick={() => remove(index)}
                >
                  Remove Item
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          type="button"
          className="add-entry-button"
          onClick={() => append(emptyItem)}
        >
          + Add Item
        </button>

        <button type="submit" className="submit-button">
          Submit Shopping List
        </button>
      </form>
    </div>
  );
};

export default App;