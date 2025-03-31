# Customer Data Collection App with Voice Input

A React and Flask-based web application for collecting customer data with voice input functionality. The app allows users to input customer information, multiple item entries, and supports voice-to-text for item descriptions.

## Features

- Customer information collection (Name, Favorite Shop)
- Multiple item entries with fields:
  - Priority
  - Item Name
  - Brand
  - Quantity
  - Unit
  - Description (with voice input support)
- Voice-to-text functionality for item descriptions
- Vertical scrolling interface
- MongoDB integration for data storage
- PDF generation for submitted forms

## Tech Stack

- Frontend:
  - React
  - TypeScript
  - React Hook Form
  - Web Speech API
  - Vite

- Backend:
  - Flask
  - MongoDB
  - Python

## Setup and Installation

1. Clone the repository:
```bash
git clone https://github.com/abhtft/Customer_Data_mob_scroll_voice1.git
cd Customer_Data_mob_scroll_voice1
```

2. Install frontend dependencies:
```bash
npm install
```

3. Install backend dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file in the root directory with your MongoDB connection string:
```
MONGODB_URI=your_mongodb_connection_string
```

5. Build the frontend:
```bash
npm run build
```

6. Start the server:
```bash
python server.py
```

The application will be available at `http://localhost:3000`

## Deployment

This application is configured for deployment on Render. The following files are included for deployment:
- `build.sh` - Build script for Render
- `requirements.txt` - Python dependencies
- `Procfile` - Process file for web server

## Usage

1. Fill in the customer details at the top of the form
2. Add new items using the "Add Entry" button
3. For item descriptions, you can either type or use the voice input button
4. Click the microphone icon to start voice recording
5. Speak your description clearly
6. The recorded text will appear in the description field
7. Submit the form when all entries are complete

## License

MIT License

## Contributing

Pull requests are welcome. For major changes, please open an issue first to discuss what you would like to change. 
"# Customer_Data_mob_scroll_voice1" 
"# Customer_Data_mob_scroll_voice1" 
