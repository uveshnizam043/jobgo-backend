// Import required modules
const express = require("express");
const multer = require("multer");
const fs = require("fs");
const fsPromise = require("fs").promises; // Using promises version of fs
const path = require("path");
// Create an Express application
const app = express();
app.use(express.json());
const instruction = `As the hiring manager's assistant, your core responsibilities involve assisting users in crafting job descriptions, refining their quality, and generating transparent Markdown-based descriptions for upcoming positions.

First, you have to ask the title of the open position 

Upon initiation, the initial query posed to the user pertains to the Position Name. Subsequently, two distinct approaches to job description creation emerge: AI-based or manual.

For AI-Based Job Description:

1. Please inquire about all the necessary details for the job description creation, and feel free to ask additional questions based on both user responses and your knowledge about the open position. Ensure a comprehensive understanding of the requirements to produce a high-quality job description.

For Manual Job Description:

1. Paste the manual job description provided by the user and validate the inclusion of all required information.
2. Analyze the job description and ensure all required information is included. If anything is missing, ask one by one questions about all the the absent details. Additionally, pose other questions based on the manual job description to gain a clear understanding of the job requirements.

Require questions for both AI-based and manual job description creation.

1. Education Background: Specify the required educational qualifications for the position.
2. Experience Requirement: Seek clarification on whether "3+ years" is a general requirement or specific to a certain position.
3. Job Location
4. Job Type (e.g., On-site, Hybrid, Remote)
5. Special Skills Required with Experience
6. Responsibilities
7. Salary Range (including currency)

You are welcome to ask additional questions based on user responses and your knowledge. Ensure to validate all the answers for accuracy.

Throughout the process, it is imperative to offer error messages for inaccuracies and prompt users for corrections. For instance, if "Finland" is entered as a position name, guide the user to rectify the error. Following these interactions, proceed to generate a well-formatted Markdown job description based on the collected information.
`

// import the required dependencies
require("dotenv").config();
const OpenAI = require("openai");
const http = require("http");
var cors = require("cors");

// import the required dependencies

// Create a OpenAI connection
const secretKey = process.env.OPENAI_API_KEY;
const openai = new OpenAI({
  apiKey: secretKey,
});
app.use(cors());
let assistant = null;
let thread = null;
let assistantId;
app.get("/create-assistant", async (req, res) => {
  const assistantFilePath = "./assistant.json";
  // Check if the assistant.json file exists
  try {
    const folderPath = path.join(__dirname, "uploads");
    const assistantFilePath = path.join(folderPath, file.originalname);
    const assistantData = await fsPromise.readFile(assistantFilePath, "utf8");
    let assistantDetails = JSON.parse(assistantData);
    assistantId = assistantDetails.assistantId;
    console.log("\nExisting assistant detected.\n");
  } catch (error) {
    // If file does not exist or there is an error in reading it, create a new assistant
    console.log("No existing assistant detected, creating new.\n");
    const assistantConfig = {
      name: "Hiring Manager Assistant",
      instructions: instruction,
      tools: [{ type: "retrieval" }], // configure the retrieval tool to retrieve files in the future
      model: "gpt-4-1106-preview",
    };

    const assistant = await openai.beta.assistants.create(assistantConfig);
    assistantDetails = { assistantId: assistant.id, ...assistantConfig };

    // Save the assistant details to assistant.json
    await fsPromise.writeFile(
      assistantFilePath,
      JSON.stringify(assistantDetails, null, 2)
    );
    assistantId = assistantDetails.assistantId;
    res.status(200).json("Assistant Is created");
  }
});
app.get("/create-thread", async (req, res) => {
  console.log("/create-thread");
  // Create a thread
  thread = await openai.beta.threads.create();
  res.status(200).json({ threadId: thread });
});

app.post("/get-msg", async (req, res) => {
  const { msg } = req.body;
  const { threadId } = req.body;
  try {
    const assistantData = await fsPromise.readFile("./assistant.json", "utf8");
    let assistantDetails = JSON.parse(assistantData);
    let assistantId1 = assistantDetails.assistantId;
    // Pass in the user question into the existing thread
    await openai.beta.threads.messages.create(threadId, {
      role: "user",
      content: msg,
    });
    // Use runs to wait for the assistant response and then retrieve it
    const run = await openai.beta.threads.runs.create(threadId, {
      assistant_id: assistantId1,
    });
    let runStatus = await openai.beta.threads.runs.retrieve(
      threadId,
      run.id
    );
    // Polling mechanism to see if runStatus is completed
    // This should be made more robust.
    while (runStatus.status !== "completed") {
      await new Promise((resolve) => setTimeout(resolve, 150));
      runStatus = await openai.beta.threads.runs.retrieve(threadId, run.id);
    }
    // Get the last assistant message from the messages array
    const messages = await openai.beta.threads.messages.list(threadId);
    // Find the last message for the current run
    const lastMessageForRun = messages.data
      .filter(
        (message) => message.run_id === run.id && message.role === "assistant"
      )
      .pop();

    // If an assistant message is found,  it
    if (lastMessageForRun) {
      res.status(200).json(`${lastMessageForRun.content[0].text.value} \n`);
    }
  } catch (error) {
    console.error(error);
  }
});
app.post("/generate-json", async (req, res) => {
  const { conversation } = req.body;
  
  const instruction = `from the conversation array please create the Jason which has the key position name, salary, job location, experience, qualification, and job description you have to fill all the values from the above conversation, and value should be to the point except from the job description, job description could be long and with proper markdown; here is conversation ${JSON.stringify(conversation)} array`;


  console.log("instruction '= ", instruction);


  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "user",
        content: instruction,
      },
    ],
    temperature: 1,
    max_tokens: 256,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });
  console.log("response", response);
  res.status(200).json(response);
});
const multerStorage = multer.diskStorage({
  destination: async (req, file, cb) => {
    try {
      const uploadFolder = "uploads";
      cb(null, "uploads");

      // const ext = file.mimetype.split("/")[1];
      // const folderPath = "D:/open-ai-assitant/uploads";
      // const assistantFilePath = path.join(folderPath, file.originalname);

      const ext = file.mimetype.split("/")[1];
 
      const folderPath = path.join(__dirname, "uploads");
      const assistantFilePath = path.join(folderPath, file.originalname);
      const uploadedFile = await openai.files.create({
        file: fs.createReadStream(assistantFilePath),
        purpose: "assistants",
      });
      const assistantData = await fsPromise.readFile(
        "./assistant.json",
        "utf8"
      );
      let assistantDetails = JSON.parse(assistantData);
      // Retrieve existing file IDs from assistant.json to not overwrite
      let existingFileIds = assistantDetails.file_ids || [];
      // Update the assistant with the new file ID

      await openai.beta.assistants.update(assistantDetails.assistantId, {
        file_ids: [...existingFileIds, uploadedFile.id],
      });
      // Update local assistantDetails and save to assistant.json
      assistantDetails.file_ids = [...existingFileIds, uploadedFile.id];
      await fsPromise.writeFile(
        assistantFilePath,
        JSON.stringify(assistantDetails, null, 2)
      );
    } catch (error) {
      console.error("Error during file upload:", error);
    }
  },
  filename: (req, file, cb) => {
    // Combine the Date in milliseconds and original name and pass as filename
    cb(null, `${file.originalname}`);
  },
});

// Use diskstorage option in multer
const upload = multer({ storage: multerStorage });

// Create a POST endpoint for '/upload' route
app.post("/upload", upload.single("file"), (req, res) => {
  res.status(200).json("File successfully uploaded");
});

app.get("/files", (req, res) => {
  const folderPath = "D:/open-ai-assitant/uploads"; // Specify the path to your folder
  fs.readdir(folderPath, (err, files) => {
    if (err) {
      console.error("Error reading folder:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    const fileList = [];
    files.forEach((file) => {
      const filePath = path.join(folderPath, file);
      const fileStats = fs.statSync(filePath);
      fileList.push({
        name: file,
        size: fileStats.size,
        fileType: path.extname(file),
        modifiedAt: fileStats.mtime,
      });
    });
    res.json({ files: fileList });
  });
});

// delete files
app.delete("/delete-file/:filename", async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, "uploads", filename); // Adjust the path as per your directory structure

  try {
    await fsPromise.unlink(filePath);
    res.status(200).json({ message: "File deleted successfully" });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});
//to run all assistant hit this endpoints
app.get("/get-all-assistant", async (req, res) => {
  try {
    let assistantList = await openai.beta.assistants.list({
      order: "desc",
      limit: "40",
    });

    while (assistantList.data.length > 0) {
      for (let i = 0; i < assistantList.data.length; i++) {
        try {
          await openai.beta.assistants.del(assistantList.data[i].id);
          console.log(
            `Assistant ${assistantList.data[i].id} deleted successfully.`,
            i
          );
        } catch (err) {
          console.error(
            `Error deleting assistant ${assistantList.data[i].id}: ${err.message}`
          );
        }
      }

      // Fetch the updated list of assistants after deletion
      assistantList = await openai.beta.assistants.list({
        order: "desc",
        limit: "40",
      });
    }

    res.status(200).json({ msg: "All assistants deleted successfully." });
  } catch (err) {
    console.error(`Error fetching assistant list: ${err.message}`);
    res.status(500).json({ msg: "Error occurred while deleting assistants." });
  }
});
//to run all assistant files hit this endpoints
app.get("/delete-assistant-file", async (req, res) => {
  try {
    const assistantData = await fsPromise.readFile("./assistant.json", "utf8");
    let assistantDetails = JSON.parse(assistantData);
    let assistantFiles = await openai.beta.assistants.files.list(
      assistantDetails.assistantId
    );
    console.log("assistantFiles", assistantFiles);
    while (assistantFiles.data.length > 0) {
      for (let i = 0; i < assistantFiles.data.length; i++) {
        try {
          await openai.beta.assistants.files.del(
            assistantDetails.assistantId,
            assistantFiles[i].id
          );
        } catch (err) {
          console.error(
            `Error deleting assistant ${assistantFiles.data[i].id}: ${err.message}`
          );
        }
      }

      // Fetch the updated list of assistants after deletion
      // assistantFiles = await openai.beta.assistants.files.list(
      //   assistantDetails.assistantId
      // );
    }

    res.status(200).json({ msg: "All assistants file deleted successfully." });
  } catch (err) {
    console.error(`Error fetching assistant list: ${err.message}`);
    res.status(500).json({ msg: "Error occurred while deleting assistants." });
  }
});

// Set up the server to listen on port 3000
const port = 3000;
app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
