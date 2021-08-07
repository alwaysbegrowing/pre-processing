# Dataset Creator Lambda

Basic flow of this lambda: 
- manually label the top ~50 games on twitch with genres
- create dict of top 100 CCCs for each of the games
- clean the dataset to make sure all the video_ids exist, and startTime/endTimes exist for each clip
- publish video_ids to the chatdownloader SNS topic so that the Prod-Downloader lambda downloads chat data for each
- 

Ideas for improvement:
- [X] Remove the hardcoded secret keys + topic ARN to read from environment
- [ ] Make local development possible (run the lambda locally via ```sam invoke```, make it so can access the aws process.env)
- [ ] Create a new ml_infra specific SNS topic and publish to it instead of using the current ready_for_download SNS topic 
- [ ] delete all the comments
- [ ] delete unused functions and files
- [ ] add command line arguments to control the data/number of clips/number of games/etc so Pete can have more control about what kind of dataset he wants to build

