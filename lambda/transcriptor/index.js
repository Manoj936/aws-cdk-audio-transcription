const AWS = require("aws-sdk"); // AWS SDK for accessing S3

const { OpenAI } = require("openai"); // OpenAI SDK for accessing Whisper API
const s3 = new AWS.S3();
const SOURCE_BUCKET = process.env.SOURCE_BUCKET_NAME;
const DEST_BUCKET = process.env.DEST_BUCKET_NAME;

const openai = new OpenAI();

module.exports.handler = async (event) => {
  
    console.log('Received event:', JSON.stringify(event, null, 2));
    
   for(const record of event.Records){
    try{

        // 1️⃣ Parse the S3 event from the SQS message
        const body = JSON.parse(record.body);
        const s3Event = JSON.parse(body.Message || record.body);
        const s3Record = s3Event.Records[0];

        const objectKey = decodeURIComponent(s3Record.s3.object.key.replace(/\+/g, ' '));

        console.log(`Processing file: ${objectKey} from bucket: ${SOURCE_BUCKET}`);

        // 2️⃣ Extract jobId from the S3 object key
       const fileName = objectKey.split('/').pop(); // always safe
       const jobId = fileName.split('.')[0];

        console.log(`Extracted jobIdd: ${jobId}`);

      

    // 4️⃣ Download the audio file from s3
       const audioFile = await s3.getObject({
            Bucket: SOURCE_BUCKET,
            Key: objectKey
        }).promise();
     
        console.log(audioFile , "audioFile")
    // 5️⃣ Transcribe the audio using OpenAI API
       const transcription = await openai.audio.transcriptions.create({
        file: audioFile.Body,
        model: "whisper-1",

       })

      console.log(transcription,"transcription");
    // 6️⃣ Save the transcription result to the destination S3 bucket
       await s3.putObject({
        Bucket: DEST_BUCKET,
        Key: `transcriptions/${jobId}.txt`,
        Body: transcription.text,
        ContentType: 'text/plain'
       }).promise()


    }
    catch(error){
        console.error('Error processing record:', error);
        throw error;
    }
   }
}

