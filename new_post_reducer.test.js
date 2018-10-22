import assert from 'assert';

import {PostTypes, UserTypes} from './src/action_types';
import deepFreeze from './utils/deep_freeze';

import {
    mergeIds,
    findPostIndicesForDelete,
    findPostIndicesForRemove,
    NEXT_POST_INDEX,
    postsInChannel,
    PREV_POST_INDEX,
    removePostsFromBlock,
    removePostsFromBlocks,
} from './new_post_reducer';

describe('reducers/entities/posts', () => {
    describe('postsInChannel', () => {
        describe('RECEIVED_NEW_POST', () => {
            it('post should be added to most recent block', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: '', post_ids: ['post1', 'post2'], prev_post_id: 'prev'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_NEW_POST,
                    data: {
                        channel_id: 'channel',
                        id: 'new',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: '', post_ids: ['new', 'post1', 'post2'], prev_post_id: 'prev'},
                    ],
                });
            });

            it('post should be added to correct channel', () => {
                const state = deepFreeze({
                    channel1: [
                        {next_post_id: '', post_ids: ['post1'], prev_post_id: 'prev1'},
                    ],
                    channel2: [
                        {next_post_id: '', post_ids: ['post2'], prev_post_id: 'prev2'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_NEW_POST,
                    data: {
                        channel_id: 'channel1',
                        id: 'new',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.equal(nextState.channel2, state.channel2);
                assert.deepEqual(nextState, {
                    channel1: [
                        {next_post_id: '', post_ids: ['new', 'post1'], prev_post_id: 'prev1'},
                    ],
                    channel2: state.channel2,
                });
            });

            it('post should be added to correct block', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1'], prev_post_id: 'prev1'},
                        {next_post_id: '', post_ids: ['post2'], prev_post_id: 'prev2'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_NEW_POST,
                    data: {
                        channel_id: 'channel',
                        id: 'new',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.equal(nextState.channel[0], state.channel[0]);
                assert.deepEqual(nextState, {
                    channel: [
                        nextState.channel[0],
                        {next_post_id: '', post_ids: ['new', 'post2'], prev_post_id: 'prev2'},
                    ],
                });
            });

            it('post should not be stored before channel is loaded', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_NEW_POST,
                    data: {
                        channel_id: 'channel',
                        id: 'post1',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.equal(nextState, state);
            });

            it('post should not be stored before most recent block is loaded', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1'], prev_post_id: 'prev1'},
                        {next_post_id: 'next2', post_ids: ['post2'], prev_post_id: 'prev2'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_NEW_POST,
                    data: {
                        channel_id: 'channel',
                        id: 'new',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.equal(nextState, state);
            });
        });

        describe('RECEIVED_POSTS_FOR_CHANNEL', () => {
            it('first posts loaded for channel', () => {
                const state = deepFreeze({});
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'nextPost',
                        order: ['post2', 'post1', 'post0'],
                        prev_post_id: 'prevPost',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [{
                        next_post_id: action.data.next_post_id,
                        post_ids: action.data.order,
                        prev_post_id: action.data.prev_post_id,
                    }],
                });
            });

            it('first posts loaded for another channel', () => {
                const state = deepFreeze({
                    channel1: [],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel2',
                    data: {
                        next_post_id: 'nextPost',
                        order: ['post2', 'post1', 'post0'],
                        prev_post_id: 'prevPost',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.equal(nextState.channel1, state.channel1);
                assert.deepEqual(nextState, {
                    channel1: state.channel1,
                    channel2: [{
                        next_post_id: action.data.next_post_id,
                        post_ids: action.data.order,
                        prev_post_id: action.data.prev_post_id,
                    }],
                });
            });

            it('new block loaded with no overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'next2',
                        order: ['post3', 'post4'],
                        prev_post_id: 'prev2',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.equal(nextState.channel[0], state.channel[0]);
                assert.deepEqual(nextState, {
                    channel: [
                        state.channel[0],
                        {next_post_id: 'next2', post_ids: ['post3', 'post4'], prev_post_id: 'prev2'},
                    ],
                });
            });

            it('new block loaded before existing one without overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'post2',
                        order: ['prev1', 'post3', 'post4'],
                        prev_post_id: 'prev2',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2', 'prev1', 'post3', 'post4'], prev_post_id: 'prev2'},
                    ],
                });
            });

            it('new block loaded before existing one with overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'post1',
                        order: ['post2', 'prev1', 'post3', 'post4'],
                        prev_post_id: 'prev2',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2', 'prev1', 'post3', 'post4'], prev_post_id: 'prev2'},
                    ],
                });
            });

            it('new block loaded after existing one without overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'next2',
                        order: ['post3', 'post4', 'next1'],
                        prev_post_id: 'post1',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next2', post_ids: ['post3', 'post4', 'next1', 'post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
            });

            it('new block loaded after existing one with overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'next2',
                        order: ['post3', 'post4', 'next1', 'post1', 'post2'],
                        prev_post_id: 'post1',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next2', post_ids: ['post3', 'post4', 'next1', 'post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
            });

            it('new block loaded between existing ones with no overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                        {next_post_id: 'next2', post_ids: ['post3', 'post4'], prev_post_id: 'prev2'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'post4',
                        order: ['prev2', 'post5', 'next1'],
                        prev_post_id: 'post1',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next2', post_ids: ['post3', 'post4', 'prev2', 'post5', 'next1', 'post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
            });

            it('new block loaded between existing ones with overlap', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next1', post_ids: ['post1', 'post2'], prev_post_id: 'prev1'},
                        {next_post_id: 'next2', post_ids: ['post3', 'post4'], prev_post_id: 'prev2'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'post3',
                        order: ['post4', 'prev2', 'post5', 'next1', 'post1'],
                        prev_post_id: 'post2',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.notEqual(nextState, state);
                assert.deepEqual(nextState, {
                    channel: [
                        {next_post_id: 'next2', post_ids: ['post3', 'post4', 'prev2', 'post5', 'next1', 'post1', 'post2'], prev_post_id: 'prev1'},
                    ],
                });
            });

            it('posts loaded within existing block', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next', post_ids: ['post1', 'post2', 'post3', 'post4', 'post5'], prev_post_id: 'prev'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'post1',
                        order: ['post2', 'post3', 'post4'],
                        prev_post_id: 'post5',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.equal(nextState, state);
            });

            it('posts loaded that make up entire existing block', () => {
                const state = deepFreeze({
                    channel: [
                        {next_post_id: 'next', post_ids: ['post1', 'post2', 'post3', 'post4', 'post5'], prev_post_id: 'prev'},
                    ],
                });
                const action = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel',
                    data: {
                        next_post_id: 'next',
                        order: ['post1', 'post2', 'post3', 'post4', 'post5'],
                        prev_post_id: 'prev',
                    },
                };

                const nextState = postsInChannel(state, action);

                assert.equal(nextState, state);
            });

            it('posts loaded for multiple channels', () => {
                const state = deepFreeze({});
                const action1 = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel1',
                    data: {
                        next_post_id: 'prev1',
                        order: ['post1', 'post2', 'post3'],
                        prev_post_id: 'next1',
                    },
                };
                const action2 = {
                    type: PostTypes.RECEIVED_POSTS_FOR_CHANNEL,
                    channelId: 'channel2',
                    data: {
                        next_post_id: 'prev2',
                        order: ['post4', 'post5', 'post6'],
                        prev_post_id: 'next2',
                    },
                };

                const nextState1 = postsInChannel(state, action1);

                assert.notEqual(nextState1, state);
                assert.deepEqual(nextState1, {
                    channel1: [
                        {next_post_id: 'prev1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'next1'},
                    ],
                });

                const nextState2 = postsInChannel(nextState1, action2);

                assert.notEqual(nextState2, nextState1);
                assert.deepEqual(nextState2, {
                    channel1: [
                        {next_post_id: 'prev1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'next1'},
                    ],
                    channel2: [
                        {next_post_id: 'prev2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'next2'},
                    ],
                });
            });
        });

        describe('POST_DELETED', () => {
            // TODO
        });

        describe('REMOVE_POST', () => {
            // TODO
        });
    });

    describe('mergeIds', () => {
        const tests = [{
            name: 'empty arrays',
            left: [],
            right: [],
            expected: [],
        }, {
            name: 'empty left array',
            left: [],
            right: ['c', 'd'],
            expected: ['c', 'd'],
        }, {
            name: 'empty right array',
            left: ['a', 'b'],
            right: [],
            expected: ['a', 'b'],
        }, {
            name: 'distinct arrays',
            left: ['a', 'b'],
            right: ['c', 'd'],
            expected: ['a', 'b', 'c', 'd'],
        }, {
            name: 'overlapping arrays',
            left: ['a', 'b', 'c', 'd'],
            right: ['c', 'd', 'e', 'f'],
            expected: ['a', 'b', 'c', 'd', 'e', 'f'],
        }, {
            name: 'left array is subset of right array',
            left: ['a', 'b'],
            right: ['a', 'b', 'c', 'd'],
            expected: ['a', 'b', 'c', 'd'],
        }, {
            name: 'right array is subset of left array',
            left: ['a', 'b', 'c', 'd'],
            right: ['c', 'd'],
            expected: ['a', 'b', 'c', 'd'],
        }];

        for (const test of tests) {
            it(test.name, () => {
                const left = [...test.left];
                const right = [...test.right];

                const actual = mergeIds(left, right);

                assert.deepEqual(actual, test.expected);

                // Arguments shouldn't be mutated
                assert.deepEqual(left, test.left);
                assert.deepEqual(right, test.right);
            });
        }
    });

    describe('findPostIndicesForDelete', () => {
        const tests = [{
            name: 'no blocks',
            blocks: [],
            expected: {
                post: null,
                comments: new Map(),
            },
        }, {
            name: 'no post found',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: {
                post: null,
                comments: new Map(),
            },
        }, {
            name: 'post found in post_ids',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'test'], prev_post_id: 'prev2'},
            ],
            expected: {
                post: {blockIndex: 1, postIndex: 2},
                comments: new Map(),
            },
        }, {
            name: 'post found in prev_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'test'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: {
                post: {blockIndex: 0, postIndex: PREV_POST_INDEX},
                comments: new Map(),
            },
        }, {
            name: 'post found in next_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'test', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: {
                post: {blockIndex: 1, postIndex: NEXT_POST_INDEX},
                comments: new Map(),
            },
        }, {
            name: 'comments found in post_ids',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            posts: {
                post1: {root_id: 'test'},
                post2: {root_id: ''},
                post3: {root_id: 'test'},
                post4: {root_id: 'post2'},
                post5: {root_id: 'test'},
                post6: {root_id: 'next1'},
            },
            expected: {
                post: null,
                comments: new Map([
                    [0, [0, 2]],
                    [1, [1]],
                ]),
            },
        }, {
            name: 'comments found in prev_post_id and next_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            posts: {
                next1: {root_id: 'test'},
                prev2: {root_id: 'test'},
            },
            expected: {
                post: null,
                comments: new Map([
                    [0, [NEXT_POST_INDEX]],
                    [1, [PREV_POST_INDEX]],
                ]),
            },
        }, {
            name: 'post and comments',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'test'], prev_post_id: 'prev2'},
            ],
            posts: {
                post2: {root_id: 'test'},
                prev1: {root_id: 'test'},
                next1: {root_id: 'test'},
                post4: {root_id: 'test'},
                post5: {root_id: 'test'},
                next2: {root_id: 'test'},
            },
            expected: {
                post: {blockIndex: 1, postIndex: 2},
                comments: new Map([
                    [0, [PREV_POST_INDEX, NEXT_POST_INDEX, 1]],
                    [1, [NEXT_POST_INDEX, 0, 1]],
                ]),
            },
        }];

        for (const test of tests) {
            it(test.name, () => {
                const actual = findPostIndicesForDelete('test', test.blocks, test.posts || {});

                assert.deepEqual(actual, test.expected);
            });
        }
    });

    describe('findPostIndicesForRemove', () => {
        const tests = [{
            name: 'no blocks',
            blocks: [],
            expected: new Map(),
        }, {
            name: 'no post found',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: new Map(),
        }, {
            name: 'post found in post_ids',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'test'], prev_post_id: 'prev2'},
            ],
            expected: new Map([
                [1, [2]],
            ]),
        }, {
            name: 'post found in prev_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'test'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: new Map([
                [0, [PREV_POST_INDEX]],
            ]),
        }, {
            name: 'post found in next_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'test', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            expected: new Map([
                [1, [NEXT_POST_INDEX]],
            ]),
        }, {
            name: 'comments found in post_ids',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            posts: {
                post1: {root_id: 'test'},
                post2: {root_id: ''},
                post3: {root_id: 'test'},
                post4: {root_id: 'post2'},
                post5: {root_id: 'test'},
                post6: {root_id: 'next1'},
            },
            expected: new Map([
                [0, [0, 2]],
                [1, [1]],
            ]),
        }, {
            name: 'comments found in prev_post_id and next_post_id',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ],
            posts: {
                next1: {root_id: 'test'},
                prev2: {root_id: 'test'},
            },
            expected: new Map([
                [0, [NEXT_POST_INDEX]],
                [1, [PREV_POST_INDEX]],
            ]),
        }, {
            name: 'post and comments',
            blocks: [
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'test'], prev_post_id: 'prev2'},
            ],
            posts: {
                post2: {root_id: 'test'},
                prev1: {root_id: 'test'},
                next1: {root_id: 'test'},
                post4: {root_id: 'test'},
                post5: {root_id: 'test'},
                next2: {root_id: 'test'},
            },
            expected: new Map([
                [0, [PREV_POST_INDEX, NEXT_POST_INDEX, 1]],
                [1, [NEXT_POST_INDEX, 0, 1, 2]],
            ]),
        }];

        for (const test of tests) {
            it(test.name, () => {
                const actual = findPostIndicesForRemove('test', test.blocks, test.posts || {});

                assert.deepEqual(actual, test.expected);
            });
        }
    });

    describe('removePostsFromBlocks', () => {
        it('posts are removed from multiple blocks', () => {
            const blocks = deepFreeze([
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ]);
            const indicesMap = new Map([
                [0, [1, 2]],
                [1, [PREV_POST_INDEX, 1]],
            ]);

            const actual = removePostsFromBlocks(blocks, indicesMap);

            assert.notEqual(actual, blocks);
            assert.deepEqual(actual, [
                {next_post_id: 'next1', post_ids: ['post1'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4'], prev_post_id: 'post6'},
            ]);
        });

        it('empty blocks are removed', () => {
            const blocks = deepFreeze([
                {next_post_id: 'next1', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'prev1'},
                {next_post_id: 'next2', post_ids: ['post4', 'post5', 'post6'], prev_post_id: 'prev2'},
            ]);
            const indicesMap = new Map([
                [0, [0, 1, 2]],
                [1, [PREV_POST_INDEX, NEXT_POST_INDEX, 1]],
            ]);

            const actual = removePostsFromBlocks(blocks, indicesMap);

            assert.notEqual(actual, blocks);
            assert.deepEqual(actual, []);
        });
    });

    describe('removePostsFromBlock', () => {
        const tests = [{
            name: 'remove one post from post_ids',
            postIndices: [1],
            expected: {next_post_id: 'next', post_ids: ['post1', 'post3', 'post4'], prev_post_id: 'prev'},
        }, {
            name: 'remove multiple posts from post_ids',
            postIndices: [0, 2, 3],
            expected: {next_post_id: 'next', post_ids: ['post2'], prev_post_id: 'prev'},
        }, {
            name: 'remove prev_post_id',
            postIndices: [PREV_POST_INDEX],
            expected: {next_post_id: 'next', post_ids: ['post1', 'post2', 'post3'], prev_post_id: 'post4'},
        }, {
            name: 'remove next_post_id',
            postIndices: [NEXT_POST_INDEX],
            expected: {next_post_id: 'post1', post_ids: ['post2', 'post3', 'post4'], prev_post_id: 'prev'},
        }, {
            name: 'remove multiple posts from post_ids and from next_post_id',
            postIndices: [NEXT_POST_INDEX, 1, 2],
            expected: {next_post_id: 'post1', post_ids: ['post4'], prev_post_id: 'prev'},
        }, {
            name: 'remove first post from post_ids and from next_post_id',
            postIndices: [NEXT_POST_INDEX, 0],
            expected: {next_post_id: 'post2', post_ids: ['post3', 'post4'], prev_post_id: 'prev'},
        }, {
            name: 'remove multiple posts from post_ids and from prev_post_id',
            postIndices: [PREV_POST_INDEX, 0, 2],
            expected: {next_post_id: 'next', post_ids: ['post2'], prev_post_id: 'post4'},
        }, {
            name: 'remove last post from post_ids and from prev_post_id',
            postIndices: [PREV_POST_INDEX, 3],
            expected: {next_post_id: 'next', post_ids: ['post1', 'post2'], prev_post_id: 'post3'},
        }, {
            name: 'remove prev_post_id and next_post_id',
            postIndices: [PREV_POST_INDEX, NEXT_POST_INDEX],
            expected: {next_post_id: 'post1', post_ids: ['post2', 'post3'], prev_post_id: 'post4'},
        }, {
            name: 'remove all of the posts from post_ids',
            postIndices: [0, 1, 2, 3],
            expected: {next_post_id: 'next', post_ids: [], prev_post_id: 'prev'},
        }, {
            name: 'remove all of the posts',
            postIndices: [PREV_POST_INDEX, NEXT_POST_INDEX, 0, 1, 2, 3],
            expected: {next_post_id: '', post_ids: [], prev_post_id: ''},
        }];

        for (const test of tests) {
            it(test.name, () => {
                const block = deepFreeze({next_post_id: 'next', post_ids: ['post1', 'post2', 'post3', 'post4'], prev_post_id: 'prev'});
                const actual = removePostsFromBlock(block, test.postIndices);

                assert.notEqual(actual, block);
                assert.deepEqual(actual, test.expected);
            });
        }
    });
})
