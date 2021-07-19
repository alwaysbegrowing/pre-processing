import boto3
import json
from clip_lib import twitch_auth, get_ccc_for_game, get_ccc_start_end_times, get_games, get_video_details


# NOTE: this lambda isn't actually hooked up to our stack, and will not be deployed. it's meant for local use.

# manual process to categorize the top 50 games:
# 1. try to find wikipedia entry for the game, and use the genre listed
# 2. for games not listed on wikipedia, go to steam store and use the genre listed on steam store
# 3. overall try to make the labels consisten. like MMORPG is standard, but wiki sometimes says 'massive multiplayer online role-playing game'. so i favored the acronym version.

f = open('genre_enum.json')
game_genres = json.load(f)
f.close()

t = open('.env')
env = json.load(t)
t.close()

TWITCH_CLIENT_ID = env['TWITCH_CLIENT_ID']
TWITCH_CLIENT_SECRET = env['TWITCH_CLIENT_SECRET']
CHAT_DOWNLOADER_TOPIC = env['CHAT_DOWNLOADER_TOPIC']

SNS = boto3.client('sns')

# parameters for clip scraping
NUMBER_OF_GAMES = 5
NUMBER_OF_CLIPS = 1
START_DATE = '2021-07-01T00:00:00Z'


def send_sns_message(video_id):
    return SNS.publish(
        TargetArn=CHAT_DOWNLOADER_TOPIC,
        Message="Test! The following videoId will be downloaded. ",
        MessageAttributes={
            "VideoId": {
                "DataType": 'String',
                "StringValue": video_id,
            }
        },
        MessageStructure='string'
    )


def handler():
    """
    Event should have the following information: The user's Twitch ID and the video ID
    This function makes 3 twitch GET API calls: /vods/{videoId}, /clips/{clipId}, /games, and a call to gql.twitch.tv/gql
    """
    access_token = twitch_auth(TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET)['access_token']
    games = get_games(TWITCH_CLIENT_ID, access_token, NUMBER_OF_GAMES)
    assert len(games) == NUMBER_OF_GAMES
    all_data = []

    for game in games:
        ccc_data = get_ccc_for_game(TWITCH_CLIENT_ID, access_token, game_id=game['id'], start_date=START_DATE,
                                    number_of_clips=NUMBER_OF_CLIPS)
        for clips in ccc_data:
            clips['game_metadata'] = game
            clips['game_metadata']['genre'] = game_genres[game["name"]]
        all_data.append(ccc_data)

    deduplicated_data = dict()
    for game_data in all_data:
        for clip_data in game_data:
            # delete any data where the VOD isn't available (probably because streamer deleted the VOD).
            # from testing, it looks like its for keys that of 'None'.
            if len(clip_data['video_id']):
                if clip_data['video_id'] not in deduplicated_data:
                    deduplicated_data[clip_data['video_id']] = [clip_data]
                else:
                    deduplicated_data[clip_data['video_id']].append(clip_data)

    clean_data = list()
    for video_id in deduplicated_data:
        vod_metada = get_video_details(TWITCH_CLIENT_ID, access_token, video_id)
        for clip_data in deduplicated_data[video_id]:
            start_time, end_time = get_ccc_start_end_times(clip_data)
            if start_time and end_time:
                time_data = {"startTime": start_time, "endTime": end_time}
                clip_data['pillar-clipRange'] = time_data
                clip_data['stream_metadata'] = vod_metada
                clean_data.append(clip_data)
        send_sns_message(video_id)

    with open('collated_clip_dataset.txt', 'w') as f:
        for item in clean_data:
            f.write("%s\n" % item)

    return {}


handler()
