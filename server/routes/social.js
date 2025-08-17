// Social Media Data Fetching Routes
const express = require('express');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { getUserById } = require('../services/userService');
const { createMemoryFromSocial } = require('../services/memoryService');
const { uploadToStorage } = require('../services/storage');
const winston = require('winston');

const router = express.Router();
const logger = winston.createLogger({ /* logger config */ });

// Rate limiting for social API calls
const socialRateLimit = require('express-rate-limit')({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // Limit to 50 social API calls per window
  message: 'Too many social media requests, please try again later.'
});

router.use(socialRateLimit);

// Twitter API v2 integration
async function fetchTwitterData(user) {
  try {
    if (!user.platform_tokens?.twitter) {
      throw new Error('Twitter not connected');
    }

    const { accessToken, tokenSecret } = user.platform_tokens.twitter;
    
    // Use Twitter API v2 with OAuth 1.0a
    const response = await axios.get('https://api.twitter.com/2/users/me/tweets', {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
      },
      params: {
        'tweet.fields': 'created_at,public_metrics,attachments',
        'expansions': 'attachments.media_keys',
        'media.fields': 'url,preview_image_url',
        'max_results': 100
      }
    });

    return response.data.data?.map(tweet => ({
      platform: 'twitter',
      platformId: tweet.id,
      type: 'social',
      title: `Tweet from ${new Date(tweet.created_at).toLocaleDateString()}`,
      content: tweet.text,
      originalDate: new Date(tweet.created_at),
      metadata: {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        url: `https://twitter.com/user/status/${tweet.id}`
      },
      media: tweet.attachments?.media_keys || []
    })) || [];

  } catch (error) {
    logger.error('Twitter data fetch error:', error);
    throw error;
  }
}

// Facebook/Instagram Graph API integration
async function fetchFacebookData(user) {
  try {
    if (!user.platform_tokens?.facebook) {
      throw new Error('Facebook not connected');
    }

    const { accessToken } = user.platform_tokens.facebook;
    
    const response = await axios.get('https://graph.facebook.com/v18.0/me/posts', {
      params: {
        access_token: accessToken,
        fields: 'id,message,created_time,attachments{media,url},likes.summary(true),comments.summary(true)',
        limit: 100
      }
    });

    return response.data.data?.map(post => ({
      platform: 'facebook',
      platformId: post.id,
      type: 'social',
      title: `Facebook Post from ${new Date(post.created_time).toLocaleDateString()}`,
      content: post.message || 'Media post',
      originalDate: new Date(post.created_time),
      metadata: {
        likes: post.likes?.summary?.total_count || 0,
        comments: post.comments?.summary?.total_count || 0,
        url: `https://facebook.com/${post.id}`
      },
      media: post.attachments?.data?.map(att => att.media?.image?.src).filter(Boolean) || []
    })) || [];

  } catch (error) {
    logger.error('Facebook data fetch error:', error);
    throw error;
  }
}

// Instagram Basic Display API
async function fetchInstagramData(user) {
  try {
    if (!user.platform_tokens?.instagram) {
      throw new Error('Instagram not connected');
    }

    const { accessToken } = user.platform_tokens.instagram;
    
    const response = await axios.get('https://graph.instagram.com/me/media', {
      params: {
        access_token: accessToken,
        fields: 'id,caption,media_type,media_url,thumbnail_url,timestamp,like_count,comments_count',
        limit: 100
      }
    });

    return response.data.data?.map(media => ({
      platform: 'instagram',
      platformId: media.id,
      type: media.media_type === 'VIDEO' ? 'video' : 'photo',
      title: `Instagram ${media.media_type.toLowerCase()} from ${new Date(media.timestamp).toLocaleDateString()}`,
      content: media.caption || '',
      originalDate: new Date(media.timestamp),
      metadata: {
        likes: media.like_count || 0,
        comments: media.comments_count || 0,
        mediaType: media.media_type,
        url: `https://instagram.com/p/${media.id}`
      },
      media: [media.media_url || media.thumbnail_url].filter(Boolean)
    })) || [];

  } catch (error) {
    logger.error('Instagram data fetch error:', error);
    throw error;
  }
}

// YouTube Data API v3
async function fetchYouTubeData(user) {
  try {
    if (!user.platform_tokens?.youtube) {
      throw new Error('YouTube not connected');
    }

    const { accessToken } = user.platform_tokens.youtube;
    
    // Get user's channel
    const channelResponse = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        part: 'id,snippet',
        mine: true
      }
    });

    if (!channelResponse.data.items?.length) {
      return [];
    }

    const channelId = channelResponse.data.items[0].id;

    // Get channel videos
    const videosResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        part: 'id,snippet',
        channelId: channelId,
        type: 'video',
        order: 'date',
        maxResults: 50
      }
    });

    return videosResponse.data.items?.map(video => ({
      platform: 'youtube',
      platformId: video.id.videoId,
      type: 'video',
      title: video.snippet.title,
      content: video.snippet.description,
      originalDate: new Date(video.snippet.publishedAt),
      metadata: {
        channelTitle: video.snippet.channelTitle,
        url: `https://youtube.com/watch?v=${video.id.videoId}`
      },
      media: [video.snippet.thumbnails?.high?.url].filter(Boolean)
    })) || [];

  } catch (error) {
    logger.error('YouTube data fetch error:', error);
    throw error;
  }
}

// Spotify Web API
async function fetchSpotifyData(user) {
  try {
    if (!user.platform_tokens?.spotify) {
      throw new Error('Spotify not connected');
    }

    const { accessToken } = user.platform_tokens.spotify;
    
    // Get recently played tracks
    const recentResponse = await axios.get('https://api.spotify.com/v1/me/player/recently-played', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: 50
      }
    });

    // Get saved playlists
    const playlistsResponse = await axios.get('https://api.spotify.com/v1/me/playlists', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      },
      params: {
        limit: 20
      }
    });

    const memories = [];

    // Add recent tracks
    recentResponse.data.items?.forEach(item => {
      memories.push({
        platform: 'spotify',
        platformId: `track_${item.track.id}_${item.played_at}`,
        type: 'audio',
        title: `Listened to "${item.track.name}" by ${item.track.artists[0].name}`,
        content: `Album: ${item.track.album.name}`,
        originalDate: new Date(item.played_at),
        metadata: {
          artist: item.track.artists[0].name,
          album: item.track.album.name,
          duration: item.track.duration_ms,
          url: item.track.external_urls.spotify
        },
        media: [item.track.album.images?.[0]?.url].filter(Boolean)
      });
    });

    // Add playlists
    playlistsResponse.data.items?.forEach(playlist => {
      if (playlist.owner.id === user.platform_username) { // Only user's own playlists
        memories.push({
          platform: 'spotify',
          platformId: playlist.id,
          type: 'audio',
          title: `Created playlist "${playlist.name}"`,
          content: playlist.description || '',
          originalDate: new Date(), // Playlists don't have creation date in API
          metadata: {
            trackCount: playlist.tracks.total,
            url: playlist.external_urls.spotify,
            public: playlist.public
          },
          media: [playlist.images?.[0]?.url].filter(Boolean)
        });
      }
    });

    return memories;

  } catch (error) {
    logger.error('Spotify data fetch error:', error);
    throw error;
  }
}

// Fetch data from all connected platforms
router.post('/sync', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    const connectedPlatforms = user.connected_platforms || {};
    
    const results = {
      success: [],
      errors: [],
      totalMemories: 0
    };

    // Sync each connected platform
    for (const [platform, config] of Object.entries(connectedPlatforms)) {
      if (!config.connected) continue;

      try {
        let memories = [];

        switch (platform) {
          case 'twitter':
            memories = await fetchTwitterData(user);
            break;
          case 'facebook':
            memories = await fetchFacebookData(user);
            break;
          case 'instagram':
            memories = await fetchInstagramData(user);
            break;
          case 'youtube':
            memories = await fetchYouTubeData(user);
            break;
          case 'spotify':
            memories = await fetchSpotifyData(user);
            break;
          default:
            continue;
        }

        // Process and save memories
        for (const memory of memories) {
          try {
            // Download and store media if present
            if (memory.media?.length > 0) {
              const uploadedMedia = [];
              for (const mediaUrl of memory.media.slice(0, 5)) { // Limit to 5 media items
                try {
                  const uploadedUrl = await uploadToStorage(mediaUrl, user.id, platform);
                  uploadedMedia.push(uploadedUrl);
                } catch (mediaError) {
                  logger.warn(`Failed to upload media: ${mediaUrl}`, mediaError);
                }
              }
              memory.media = uploadedMedia;
            }

            await createMemoryFromSocial(user.id, memory);
            results.totalMemories++;
          } catch (memoryError) {
            logger.error(`Failed to save memory from ${platform}:`, memoryError);
          }
        }

        results.success.push({
          platform,
          count: memories.length
        });

        logger.info(`Synced ${memories.length} memories from ${platform} for user ${user.id}`);

      } catch (platformError) {
        logger.error(`Failed to sync ${platform} for user ${user.id}:`, platformError);
        results.errors.push({
          platform,
          error: platformError.message
        });
      }
    }

    // Update last sync time
    await updateUser(user.id, {
      last_sync_at: new Date()
    });

    res.json(results);

  } catch (error) {
    logger.error('Social sync error:', error);
    res.status(500).json({ error: 'Failed to sync social media data' });
  }
});

// Get sync status
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    const user = await getUserById(req.user.id);
    
    res.json({
      lastSyncAt: user.last_sync_at,
      connectedPlatforms: Object.keys(user.connected_platforms || {}).filter(
        platform => user.connected_platforms[platform]?.connected
      )
    });

  } catch (error) {
    logger.error('Sync status error:', error);
    res.status(500).json({ error: 'Failed to get sync status' });
  }
});

// Manual sync for specific platform
router.post('/sync/:platform', authenticateToken, async (req, res) => {
  try {
    const { platform } = req.params;
    const user = await getUserById(req.user.id);
    
    if (!user.connected_platforms?.[platform]?.connected) {
      return res.status(400).json({ error: `${platform} is not connected` });
    }

    let memories = [];
    
    switch (platform) {
      case 'twitter':
        memories = await fetchTwitterData(user);
        break;
      case 'facebook':
        memories = await fetchFacebookData(user);
        break;
      case 'instagram':
        memories = await fetchInstagramData(user);
        break;
      case 'youtube':
        memories = await fetchYouTubeData(user);
        break;
      case 'spotify':
        memories = await fetchSpotifyData(user);
        break;
      default:
        return res.status(400).json({ error: 'Unsupported platform' });
    }

    // Save memories
    let savedCount = 0;
    for (const memory of memories) {
      try {
        if (memory.media?.length > 0) {
          const uploadedMedia = [];
          for (const mediaUrl of memory.media.slice(0, 5)) {
            try {
              const uploadedUrl = await uploadToStorage(mediaUrl, user.id, platform);
              uploadedMedia.push(uploadedUrl);
            } catch (mediaError) {
              logger.warn(`Failed to upload media: ${mediaUrl}`, mediaError);
            }
          }
          memory.media = uploadedMedia;
        }

        await createMemoryFromSocial(user.id, memory);
        savedCount++;
      } catch (memoryError) {
        logger.error(`Failed to save memory from ${platform}:`, memoryError);
      }
    }

    logger.info(`Manual sync: ${savedCount} memories from ${platform} for user ${user.id}`);

    res.json({
      platform,
      memoriesFound: memories.length,
      memoriesSaved: savedCount
    });

  } catch (error) {
    logger.error(`Manual sync error for ${req.params.platform}:`, error);
    res.status(500).json({ error: `Failed to sync ${req.params.platform}` });
  }
});

module.exports = router;