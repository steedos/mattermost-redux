import {PostTypes, UserTypes} from './src/action_types';

export function postsInChannel(state = {}, action, prevPosts, nextPosts) { // TODO rename this to postIdsByChannel?
    switch (action.type) {
    case PostTypes.RECEIVED_NEW_POST: {
        const post = action.data;
        const postsForChannel = state[post.channel_id];

        if (!postsForChannel) {
            // Don't store any posts for a channel until we've initially loaded it
            return state;
        }

        // Find the block containing the most recent posts in the channel
        const recentBlockIndex = postsForChannel.findIndex((block) => block.next_post_id === '');
        const recentBlock = postsForChannel[recentBlockIndex];

        if (!recentBlock) {
            // Don't store the most recent posts in the channel until we've initially loaded them
            return state;
        }

        // Add the new post id as the newest post in the most recent block
        const nextPostsForChannel = [...postsForChannel];
        nextPostsForChannel[recentBlockIndex] = {
            next_post_id: '',
            post_ids: [post.id, ...recentBlock.post_ids],
            prev_post_id: recentBlock.prev_post_id,
        };

        return {
            ...state,
            [post.channel_id]: nextPostsForChannel,
        };
    }

    case PostTypes.RECEIVED_POSTS_FOR_CHANNEL: {
        // n is the number of posts received
        // N is the number of blocks in postIdsByChannel[channelId]
        // M is the number of posts in the channel across all blocks
        const postList = action.data;

        const nextPostsForChannel = action.channelId in state ? [...state[action.channelId]] : [];

        // HARRISON this assumes that prev_id and next_id have been set already, so no backwards compatibility yet

        let prevIndex = -1;
        let nextIndex = -1;

        // Find the blocks that come before and after the received posts, if we have them
        nextPostsForChannel.forEach((block, i) => { // O(N)
            if (prevIndex === -1 && (block.prev_post_id === postList.prev_post_id || block.post_ids.includes(postList.prev_post_id))) {
                prevIndex = i;
            }

            if (nextIndex === -1 && (block.next_post_id === postList.next_post_id || block.post_ids.includes(postList.next_post_id))) {
                nextIndex = i;
            }
        });

        if (nextIndex !== -1 && nextIndex === prevIndex) { // O(1)
            // These posts are in the middle of another block, so we should already have all these IDs.
            // Nothing to do here since we don't change the order
            return state;
        }

        if (nextIndex === -1 && prevIndex === -1) { // O(1)
            // Received block doesn't overlap, so just add it
            nextPostsForChannel.push({
                next_post_id: postList.next_post_id,
                post_ids: postList.order,
                prev_post_id: postList.prev_post_id,
            });
        } else if (nextIndex !== -1 && prevIndex === -1) { // O(n + M)
            // We have the posts directly after these, so add these to the start of that block
            const nextBlock = nextPostsForChannel[nextIndex];

            nextPostsForChannel[nextIndex] = {
                next_post_id: nextBlock.next_post_id,
                post_ids: mergeIds(nextBlock.post_ids, postList.order),
                prev_post_id: postList.prev_post_id,
            };
        } else if (nextIndex === -1 && prevIndex !== -1) { // O(n + M)
            // We have the posts directly before these, so add these to the end of that block
            const prevBlock = nextPostsForChannel[prevIndex];

            nextPostsForChannel[prevIndex] = {
                next_post_id: postList.next_post_id,
                post_ids: mergeIds(postList.order, prevBlock.post_ids),
                prev_post_id: prevBlock.prev_post_id,
            };
        } else { // O(n + M)
            // We have the posts directly before and after these, so merge all 3 blocks with this one in the middle
            const prevBlock = nextPostsForChannel[prevIndex];
            const nextBlock = nextPostsForChannel[nextIndex];

            // Replace previous block with new one and remove next one
            nextPostsForChannel[prevIndex] = {
                next_post_id: nextBlock.next_post_id,
                post_ids: mergeIds(nextBlock.post_ids, mergeIds(postList.order, prevBlock.post_ids)),
                prev_post_id: prevBlock.prev_post_id,
            };

            nextPostsForChannel.splice(nextIndex, 1);
        }

        return {
            ...state,
            [action.channelId]: nextPostsForChannel,
        };
    }

    case PostTypes.POST_DELETED: {
        const post = action.data;

        const postsForChannel = state[post.channel_id];
        if (!postsForChannel) {
            return state;
        }

        // TODO update root post
        // TODO remove comments

        return state;
    }

    case PostTypes.REMOVE_PENDING_POST:
    case PostTypes.REMOVE_POST: {
        const post = action.data;

        const postsForChannel = state[post.channel_id];
        if (!postsForChannel) {
            return state;
        }

        const indices = findPostIndices(postsForChannel, prevPosts, post.id);

        if (!indices.post && indices.comments.size === 0) {
            return state;
        }

        const toRemove = indices.comments;
        if (indices.post) {

        }

        return {
            ...state,
            [post.channel_id]: removePosts(postsForChannel, indices),
        };
    }

    case UserTypes.LOGOUT_SUCCESS:
        return {};
    default:
        return state;
    }
}

// Given two ordered arrays, returns a new array made up by merging them without repeating any overlapping items.
//
// This code makes the following assumptions:
//  1. Each item will only appear at most once in each array, so there will be no duplicates in the output of this function.
//  2. If an item appears in both arrays, the other items before and after (if they exist) will be the same. In other words,
//     the arrays must be ordered the same way.
//
// For example, the following pairs of arguments are valid:
//  - left=[1, 2, 3, 4], right=[3, 4, 5, 6]
//  - left=[a, c, d], right=[b, z, e]
// While the following pairs of arguments are invalid:
//  - left=[1, 2, 3, 4], right=[4, 3, 5] (Order of 3 and 4 is different)
//  - left=[1, 1, 2], right=[2, 3, 3] (Duplicate items)
//  - left=[a, c, d, b], right=[c, d] (right ends before left does)
export function mergeIds(left, right) { // O(A + B) where A and B are the length of each array
    const result = [...left];

    const seen = new Set(left);
    for (const id of right) {
        if (seen.has(id)) {
            continue;
        }

        result.push(id);
    }

    return result;
}

export const PREV_POST_INDEX = -1;
export const NEXT_POST_INDEX = -2;

// Finds the indices of a given post and its comments for use when marking the post as deleted and then removing its comments.
// Returns an object containing:
//  - post - the block/post index of the post as an object of the form {blockIndex: number, postIndex: number}
//  - comments - a Map of block indices to an array of the post indices containing the post's comments
export function findPostIndicesForDelete(postId, blocks, posts) {
    let post = null;
    const comments = new Map();

    iteratePostIds(blocks, (id, blockIndex, postIndex) => {
        if (id === postId) {
            post = {
                blockIndex,
                postIndex,
            };
        } else if ((posts[id] && posts[id].root_id === postId)) {
            if (comments.has(blockIndex)) {
                comments.get(blockIndex).push(postIndex);
            } else {
                comments.set(blockIndex, [postIndex]);
            }
        }
    });

    return {
        post,
        comments,
    };
}

// Finds the indices of a given post and its comments for use when removing the post and its comments. Returns a Map of block
// indices to a sorted array of the post indices to be removed.
export function findPostIndicesForRemove(postId, blocks, posts) {
    const indices = new Map();

    iteratePostIds(blocks, (id, blockIndex, postIndex) => {
        if (id === postId || (posts[id] && posts[id].root_id === postId)) {
            if (indices.has(blockIndex)) {
                indices.get(blockIndex).push(postIndex);
            } else {
                indices.set(blockIndex, [postIndex]);
            }
        }
    });

    return indices;
}

// Iterates through all post IDs in the given blocks by going through each block's prev_post_id, next_post_id, and then post_ids
// in that order.
function iteratePostIds(blocks, callback) { // O(M) where M is the number of posts in the channel
    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        callback(block.prev_post_id, i, PREV_POST_INDEX);
        callback(block.next_post_id, i, NEXT_POST_INDEX);

        for (let j = 0; j < block.post_ids.length; j++) {
            callback(block.post_ids[j], i, j);
        }
    }
}

export function removePostsFromBlocks(blocks, indicesMap) {
    const nextBlocks = [...blocks];

    // Remove the posts
    for (const [blockIndex, postIndices] of indicesMap) {
        nextBlocks[blockIndex] = removePostsFromBlock(nextBlocks[blockIndex], postIndices);
    }

    // Remove any blocks that are now empty
    for (let i = nextBlocks.length - 1; i >= 0; i--) {
        const block = nextBlocks[i];

        if (block.post_ids.length === 0) {
            nextBlocks.splice(i, 1);
        }
    }

    // HARRISON This doesn't merge blocks that are now adjacent because we removed the only posts between them. Will that violate
    // any of our assumptions when adding new posts?

    return nextBlocks;
}

export function removePostsFromBlock(block, postIndices) {
    const nextBlock = {
        next_post_id: block.next_post_id,
        post_ids: [...block.post_ids],
        prev_post_id: block.prev_post_id,
    };

    // Loop through the indices backwards so that we don't mess up the indices of items that still need to be removed
    for (let i = postIndices.length - 1; i >= 0; i--) {
        const index = postIndices[i];

        if (index === NEXT_POST_INDEX) {
            // The post follows the block
            nextBlock.next_post_id = nextBlock.post_ids[0] || '';
            nextBlock.post_ids = nextBlock.post_ids.slice(1);
            // HARRISON when writing the selectors, maybe return the post for next_post_id/prev_post_id when we have it? That way, this won't cause us to lose a post when the next/prev post is deleted
        } else if (index === PREV_POST_INDEX) {
            // The post comes before the block
            nextBlock.prev_post_id = nextBlock.post_ids[nextBlock.post_ids.length - 1] || '';
            nextBlock.post_ids = nextBlock.post_ids.slice(0, nextBlock.post_ids.length - 1);
        } else {
            // The post is in the middle of the block.
            const nextPostIds = nextBlock.post_ids;
            nextPostIds.splice(index, 1);
            nextBlock.post_ids = nextPostIds;
        }
    }

    return nextBlock;
}
