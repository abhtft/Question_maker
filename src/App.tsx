import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import jsPDF from 'jspdf';
import VoiceInput from './VoiceInput';

interface ItemInput {
  itemName: string;
  brand: string;
  quantity: string;
  unit: string;
  priority: string;
  description: string;
}

interface FormInputs {
  customerName: string;
  favoriteShop: string;
  items: Array<{
    priority: string;
    itemName: string;
    brand: string;
    quantity: string;
    unit: string;
    description: string;
  }>;
}

const emptyItem: ItemInput = {
  itemName: '',
  brand: '',
  quantity: '',
  unit: '',
  priority: '',
  description: ''
};

const App: React.FC = () => {
  const [showThankYou, setShowThankYou] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  const { register, control, handleSubmit, reset, setValue, getValues } = useForm<FormInputs>({
    defaultValues: {
      customerName: '',
      favoriteShop: '',
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
      
      // Always preserve the original description
      setValue(`items.${index}.description`, description);
    } catch (error) {
      console.error('Error analyzing description:', error);
      alert('Failed to analyze the description. Please try again.');
    }
  };

  const generatePDF = (data: FormInputs) => {
    // Create new PDF in A4 format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set title
    doc.setFontSize(24);
    doc.setTextColor(25, 71, 128); // Dark blue color
    doc.text('Customer Shopping List', doc.internal.pageSize.width / 2, 25, { align: 'center' });

    // Add bill number and date
    doc.setFontSize(12);
    doc.setTextColor(128, 128, 128); // Gray color
    const currentDate = new Date();
    const billNumber = `BILL-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const formattedDate = `${currentDate.getDate()}/${currentDate.getMonth() + 1}/${currentDate.getFullYear()}, ${currentDate.getHours()}:${String(currentDate.getMinutes()).padStart(2, '0')}:${String(currentDate.getSeconds()).padStart(2, '0')} ${currentDate.getHours() >= 12 ? 'pm' : 'am'}`;
    
    doc.text(`Bill Number: ${billNumber}`, 20, 45);
    doc.text(`Date: ${formattedDate}`, 20, 52);
    doc.text(`Customer Name: ${data.customerName}`, 20, 59);
    doc.text(`Favorite Shop: ${data.favoriteShop}`, 20, 66);

    // Table header
    const startY = 80;
    const headerHeight = 10;
    const rowHeight = 20; // Increased row height for wrapped text
    const columns = {
      '#': { x: 20, width: 10 },
      'Item Name': { x: 30, width: 30 },
      'Brand': { x: 60, width: 25 },
      'Quantity': { x: 85, width: 15 },
      'Unit': { x: 100, width: 15 },
      'Priority': { x: 115, width: 20 },
      'Description': { x: 135, width: 55 } // Increased width for description
    };

    // Draw table header
    doc.setFillColor(25, 71, 128); // Dark blue for header
    doc.setTextColor(255, 255, 255); // White text for header
    doc.rect(20, startY, 170, headerHeight, 'F');
    
    // Add header texts
    doc.setFontSize(10);
    Object.entries(columns).forEach(([key, value]) => {
      doc.text(key, value.x, startY + 7);
    });

    // Add table content
    doc.setTextColor(0, 0, 0); // Black text for content
    let currentY = startY + headerHeight;

    // Function to split text into lines
    const splitTextIntoLines = (text: string, maxWidth: number) => {
      const words = text.split(' ');
      const lines: string[] = [];
      let currentLine = words[0];

      for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = doc.getStringUnitWidth(currentLine + ' ' + word) * doc.getFontSize() / doc.internal.scaleFactor;
        
        if (width < maxWidth) {
          currentLine += ' ' + word;
        } else {
          lines.push(currentLine);
          currentLine = word;
        }
      }
      lines.push(currentLine);
      return lines;
    };

    data.items.forEach((item, index) => {
      const maxWidth = 50; // Maximum width for description text in mm
      
      // Add zebra striping
      if (index % 2 === 0) {
        doc.setFillColor(245, 245, 245);
        doc.rect(20, currentY, 170, rowHeight, 'F');
      }

      // Draw cell contents
      doc.text(String(index + 1), columns['#'].x, currentY + 6);
      doc.text(item.itemName, columns['Item Name'].x, currentY + 6);
      doc.text(item.brand, columns['Brand'].x, currentY + 6);
      doc.text(item.quantity, columns['Quantity'].x, currentY + 6);
      doc.text(item.unit, columns['Unit'].x, currentY + 6);
      doc.text(item.priority.toLowerCase(), columns['Priority'].x, currentY + 6);

      // Handle description with text wrapping
      const descriptionLines = splitTextIntoLines(item.description, maxWidth);
      descriptionLines.forEach((line, lineIndex) => {
        doc.text(line, columns['Description'].x, currentY + 6 + (lineIndex * 4));
      });

      currentY += rowHeight;

      // Add a new page if we're near the bottom
      if (currentY > doc.internal.pageSize.height - rowHeight) {
        doc.addPage();
        currentY = 20; // Reset Y position on new page
      }
    });

    // Draw table borders
    doc.setDrawColor(200, 200, 200); // Light gray for borders
    doc.rect(20, startY, 170, currentY - startY, 'S'); // Outer border
    
    // Vertical lines
    let currentX = 20;
    Object.values(columns).forEach(value => {
      doc.line(currentX, startY, currentX, currentY);
      currentX += value.width;
    });

    // Save PDF
    doc.save(`shopping-list-${data.customerName}.pdf`);
  };

  const onSubmit = async (data: FormInputs) => {
    try {
      const response = await fetch('/api', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        generatePDF(data);  // Generate PDF after successful submission
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
                <div className="analyze-button-container">
                  <button
                    type="button"
                    className="analyze-button"
                    onClick={() => analyzeDescription(index)}
                    disabled={!getValues(`items.${index}.description`)}
                  >
                    Analyze
                  </button>
                </div>
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
                  {...register(`items.${index}.itemName`)}
                  placeholder="Item Name"
                  className="item-input"
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
                  <option value="piece">piece</option>
                  <option value="pieces">pieces</option>
                  <option value="pcs">pcs</option>
                </select>
              </div>

              <div className="form-row">
                <div className="description-container">
                  <textarea
                    {...register(`items.${index}.description`)}
                    placeholder="Description (or use voice input)"
                    className="description-input"
                  />
                  <div className="voice-input-container">
                    <VoiceInput
                      onTextReceived={(text) => setValue(`items.${index}.description`, text)}
                      isRecording={isRecording}
                      setIsRecording={setIsRecording}
                    />
                  </div>
                </div>
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