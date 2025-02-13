require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const SECRET_KEY = process.env.SECRET_KEY;


const PORT = 3006;

let GrapherBookingsCollectionObj, usersCollectionObj
app.use(express.json());
app.use(cors({ origin: '*' }));

const uri = 'mongodb+srv://charan333gt:dxIFPPQ3MDGcc4DZ@cluster0.ezgqv.mongodb.net/';
const client = new MongoClient(uri);


const axios = require('axios');

async function callApi() {
  try {
    const response = await axios.get('https://photographyhirebackend.onrender.com/api/login');
    // console.log('API Response:', response.data);
  } catch (error) {
    console.error('Error calling API:', error);
  }
}

setInterval(callApi, 840000);

callApi();


client.connect()
  .then((client) => {
    db = client.db('GrapherHireDB');
    GrapherBookingsCollectionObj = db.collection('GrapherBookings');
    usersCollectionObj = db.collection('users');
    UnionDBCollectionObj = db.collection('UnionDB');
    //usersCollectionObj_Zenmart = db2.collection('users'); // ✅ Store ZenmartDB users separately

    
    console.log('Connected to MongoDB database');
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
  });
  // Start the Server
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });


  //______________________________________________________________________________________________-

  // User Registration
  app.post('/api/register', async (req, res) => {
    const { name, email, password, mobile, district, unionId, role, organizationName, typeOfGrapher } = req.body;
    
    if (!name || !email || !password || !mobile || !district || !unionId || !role) {
        return res.status(400).json({ message: 'All fields are required' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = {
            name,
            email,
            password: hashedPassword,
            mobile,
            district,
            unionId,
            role,
            organizationName: role === 'organizer' ? organizationName : null,
            typeOfGrapher: role === 'grapher' ? typeOfGrapher : null
        };
        console.log(newUser)
        
        const result = await usersCollectionObj.insertOne(newUser);
        
        const token = jwt.sign({ id: result.insertedId, name, role }, SECRET_KEY, { expiresIn: '30d' });
        
        res.status(201).json({
            id: result.insertedId,
            role,
            message: 'Account created successfully',
            jwt_token: token
        });
    } catch (err) {
        console.error('Error registering user:', err);
        res.status(500).json({ message: 'Error creating account' });
    }
});
  
  
// User Login
app.post('/api/login', async (req, res) => {
    console.log("Received Request Body:", req.body);

    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ message: "Invalid JSON format" });
    }

    const { mobile, password } = req.body;

    if (!mobile || !password) {
        return res.status(400).json({ message: 'Mobile and password are required' });
    }

    try {
        const user = await usersCollectionObj.findOne({ mobile: mobile });

        if (!user) {
            return res.status(401).json({ message: 'Invalid mobile number or password' });
        }

        console.log("Stored Hashed Password:", user.password);
        console.log("Entered Password:", password);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log("Password Match:", isMatch);

        if (!isMatch) {
            return res.status(401).json({ message: 'Invalid mobile number or password' });
        }

        const token = jwt.sign({ id: user._id, name:user.name, role: user.role }, SECRET_KEY, { expiresIn: '30d' });

        return res.status(200).json({
            id: user._id,
            role: user.role,
            name:user.name,
            message: 'Login successful',
            jwt_token: token
        });
    } catch (err) {
        console.error('Error logging in:', err);
        return res.status(500).json({ message: 'Internal server error' });
    }
});





//_______________________________________________________________________________________________


// Fetch users by role
app.get("/api/users/:role", async (req, res) => {
    try {
        const { role } = req.params;
        console.log(role)
        const users = await usersCollectionObj.find({ role }).toArray(); // Convert cursor to array
        res.status(200).json(users);
    } catch (error) {
        console.error("Error fetching users by role:", error);
        res.status(500).json({ message: "Server Error", error });
    }
});


//______________________________________________________________________________________---

// Fetch members from UnionDBCollectionObj
app.get('/api/members', async (req, res) => {
    const { unionId, mobile } = req.query;
    console.log(unionId,mobile)
    if (!unionId || !mobile) {
        return res.status(400).json({ message: 'Union ID and mobile are required' });
    }
    console.log("Querying MongoDB with:", { UnionId: typeof(unionId), Mobile: typeof(mobile) });

    try {
        const member = await UnionDBCollectionObj.findOne({ UnionId:unionId, Mobile:  mobile });
        
        if (!member) { 
            return res.status(404).json({ message: 'Member not found' });
        }
        
        res.status(200).json(member);
    } catch (err) {
        console.error('Error fetching member:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//_______________________________________________________________--

// Booking Request API
// Booking Request API
app.post('/api/bookings/request', async (req, res) => {
    const { grapherId, organizerName, date } = req.body;

    if (!grapherId || !organizerName || !date) {
        return res.status(400).json({ message: "All fields are required" });
    }

    try {
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId), role: "grapher" });

        if (!grapher) {
            return res.status(404).json({ message: "Grapher not found" });
        }

        // Generate a unique ID for the request
        const requestId = new ObjectId();

        // Add the booking request to the grapher's request list with an ID
        await usersCollectionObj.updateOne(
            { _id: new ObjectId(grapherId) },
            { $push: { requests: { _id: requestId, organizerName, date } } }
        );

        res.status(200).json({ message: "Booking request sent successfully", requestId });

    } catch (error) {
        console.error("Error processing booking request:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

//_____________________________________________________________

// Fetch job requests for a specific grapher
app.get('/api/grapher/job-requests', async (req, res) => {
    const { grapherId } = req.query;
    if (!grapherId) {
        return res.status(400).json({ message: 'Grapher ID is required' });
    }
    try {
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId) });
        if (!grapher) {
            return res.status(404).json({ message: 'Grapher not found' });
        }
        res.status(200).json(grapher.requests || []);
    } catch (err) {
        console.error('Error fetching job requests:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//_______________________________________________________________________________

// Handle job response (Accept/Reject)
app.post('/api/grapher/job-response', async (req, res) => {
    const { id, status } = req.body;
    const grapherId = req.headers['grapher-id']; // Get grapher ID from request header

    if (!id || !status || !grapherId) {
        return res.status(400).json({ message: "Job ID, status, and grapher ID are required" });
    }

    try {
        // Find the grapher in the database
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId) });
        if (!grapher) {
            return res.status(404).json({ message: "Grapher not found" });
        }

        // Find the job request by ID
        const jobRequest = grapher.requests.find(request => request._id.toString() === id);
        if (!jobRequest) {
            return res.status(404).json({ message: "Job request not found" });
        }

        const { organizerName, date } = jobRequest;
        console.log(organizerName)

        // Find the organizer in the database
        const organizer = await usersCollectionObj.findOne({ organizationName: organizerName });
        if (!organizer) {
            return res.status(404).json({ message: "Organizer not found" });
        }

        if (status === "accepted") {
            // Add booking details to the organizer's data
            await usersCollectionObj.updateOne(
                { _id: new ObjectId(organizer._id) },
                { $push: { bookings: { id: new ObjectId(id), date, grapher: grapher.name } } }
            );

            // Add confirmed job to the grapher's data
            await usersCollectionObj.updateOne(
                { _id: new ObjectId(grapherId) },
                { $push: { confirmedJobs: { id: new ObjectId(id), date, organizer: organizer.organizationName } } }
            );
        }

        // Remove the job request from the grapher's list
        await usersCollectionObj.updateOne(
            { _id: new ObjectId(grapherId) },
            { $pull: { requests: { _id: new ObjectId(id) } } }
        );

        res.status(200).json({ message: `Job request ${status} successfully` });
    } catch (err) {
        console.error("Error handling job response:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});


//________________________________________________________________


// Fetch upcoming bookings for a specific grapher
app.get('/api/grapher/bookings', async (req, res) => {
    const grapherId = req.headers['grapher-id'];
    if (!grapherId) {
        return res.status(400).json({ message: 'Grapher ID is required' });
    }
    try {
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId) });
        if (!grapher) {
            return res.status(404).json({ message: 'Grapher not found' });
        }
        res.status(200).json(grapher.confirmedJobs || []);
    } catch (err) {
        console.error('Error fetching bookings:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});



//_________________________________________________________________

app.get('/api/organizer/booked-graphers', async (req, res) => {
    console.log("Received Headers:", req.headers); // Debugging
    const organizerName = req.headers['organizer-name']; // Retrieve organizer name

    if (!organizerName) {
        return res.status(400).json({ message: "Organizer name is required" });
    }

    console.log("Organizer Name:", organizerName.replace(/^"|"$/g, ''));

    try {
        const organizer = await usersCollectionObj.findOne({
            organizationName: organizerName.replace(/^"|"$/g, ''),
            role: "organizer"
        });

        if (!organizer) {
            return res.status(404).json({ message: "Organizer not found" });
        }

        res.status(200).json(organizer.bookings || []);
    } catch (err) {
        console.error("Error fetching booked photographers:", err);
        res.status(500).json({ message: "Internal server error" });
    }
});

//______________________________________________________________________--

// Fetch booked dates for a specific grapher
app.get('/api/:grapherId/booked-dates', async (req, res) => {
    const { grapherId } = req.params;
    if (!grapherId) {
        return res.status(400).json({ message: 'Grapher ID is required' });
    }
    try {
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId) });
        if (!grapher) {
            return res.status(404).json({ message: 'Grapher not found' });
        }
        const bookedDates = grapher.confirmedJobs?.map(job => job.date) || [];
        res.status(200).json(bookedDates);
    } catch (err) {
        console.error('Error fetching booked dates:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});

//________________________________________________________________

// Add Photographer's Portfolio and Instagram
// Add Photographer's Portfolio and Instagram
app.post('/api/grapher/update', async (req, res) => {
    const { grapherId, portfolio, instagram } = req.body;
    
    if (!grapherId) {
        return res.status(400).json({ message: 'Grapher ID is required' });
    }

    try {
        const objectId = new ObjectId(grapherId);

        // Ensure the fields exist as arrays
        await usersCollectionObj.updateOne(
            { _id: objectId },
            {
                $setOnInsert: { portfolio: [], instagram: [] }
            },
            { upsert: true }
        );

        // Prepare update fields
        const updateFields = {};
        if (portfolio) updateFields.portfolio = portfolio;
        if (instagram) updateFields.instagram = instagram;

        // Update Grapher's profile
        const updatedGrapher = await usersCollectionObj.findOneAndUpdate(
            { _id: grapherId },
            { 
                $push: {
                    ...(portfolio ? { portfolio: portfolio } : {}),
                    ...(instagram ? { instagram: instagram } : {})
                }
            },
            { returnDocument: 'after' }
        );

        if (!updatedGrapher.value) {
            return res.status(404).json({ message: 'Grapher not found' });
        }

        res.status(200).json(updatedGrapher.value);
    } catch (err) {
        console.error('Error updating profile:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});



//___________________________________________________________________

// Fetch Photographer's Profile
app.get('/api/grapher/profile', async (req, res) => {
    const { grapherId } = req.query;
    if (!grapherId) {
        return res.status(400).json({ message: 'Grapher ID is required' });
    }
    try {
        const grapher = await usersCollectionObj.findOne({ _id: new ObjectId(grapherId) });
        if (!grapher) {
            return res.status(404).json({ message: 'Grapher not found' });
        }
        res.status(200).json(grapher);
    } catch (err) {
        console.error('Error fetching profile:', err);
        res.status(500).json({ message: 'Internal server error' });
    }
});