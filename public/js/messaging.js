var socket = io.connect();

// unique message id for each sent message from this socket
var nextMessageId = 1;

var unconfirmedMessages = [];

/* Hides all conversations except the one for the given partner id.
 * If no chat area exists for the given partner id, one will be created.
 *
 * Returns true if a chat area existed and false otherwise.
 */
function showConversation(partnerId) {
    var $conversations = $('section#chat-area div.conversation');
    
    var foundTarget = false;
    
    $conversations.each(function(index, conversation) {
        var $conversation = $(conversation);
        
        if ($conversation.attr('data-partner-id') == partnerId) {
            foundTarget = true;
            $conversation.show();
        }
        else {
            $conversation.hide();
        }
    });
    
    return foundTarget;
}


/* Searches for a conversation with the given partner.
 *
 * Returns a jQueryfied version of the conversation if found and null otherwise.
 */
function findConversation(partnerId) {
    var $conversations = $('section#chat-area div.conversation');
    
    var $conversation = $conversations.filter(function(index, conversation) {
        return $(conversation).attr('data-partner-id') == partnerId;
    })
    
    return $conversation.length === 1 ? $conversation : null;
}


/* Creates a new conversation for the given partner id and adds it to the chat area.
 *
 * Returns a jQuerified version of the conversation.
 */
function createConversation(partnerId) {
    var $conversation = $('<div>', {
        class: 'conversation row',
        'data-partner-id': partnerId
    });
    
    // set the height of the conversation, as this wasn't done before
    var conversationHeight = calculateConversationHeight();
    $conversation.css('minHeight', conversationHeight);
    $conversation.css('maxHeight', conversationHeight)
    
    $conversation.prependTo($('section#chat-area'));
    
    return $conversation;
}


/* Should be called whenever a user row is clicked on. Triggers a changing of
 * the conversation.
 *
 * Note that this function should be called with this context being the user row.
 */
function onClickUser(e) {
    e.preventDefault();
    
    var $this = $(this);
    var userId = $this.attr('data-user-id');
    
    // if the user is already being shown, do nothing
    if (userId === window.currentPartnerId) {
        return;
    }
    
    window.currentPartnerId = userId;
    
    // otherwise, show the chat area
    if (showConversation(userId)) {
        // if the chat area already existed, just clear the new message styling
        $this.removeClass('new-message-exists');
        ;
    }
    else {
        createConversation(userId);
        // this is a new chat area, so load previous messages?
    }
    
    // remove the selected class from all user rows and add it only to this one
    $('section#user-list .user').removeClass('selected');
    $this.addClass('selected');
    
    return;
}


/* Calculates the height avilable to the messaging area section, after accounting
 * for elements such as the header and footer.
 *
 * Returns the height as an integer.
 */
function calculateMessagingAreaHeight() {
    var $elements = $('body > *:not(main#messaging)');
    
    var usedHeight = 0;
    $elements.each(function(index, element) {
        // include the margin in the calculation
        usedHeight += $(element).outerHeight(true);
    });
    
    return $(window).height() - usedHeight;
}


/* Calculates the height avilable to conversation areas, after accounting
 * for elements such as the header, footer, and message send area.
 *
 * Returns the height as an string with 'px' appended.
 */
function calculateConversationHeight() {
    var conversationHeight = calculateMessagingAreaHeight();
    conversationHeight -= $('section#chat-area div#message-send-area').outerHeight();
    
    return conversationHeight + 'px';
}


/* Resizes the main messaging area so that it uses the entire available height */
function resizeMessagingArea() {
    // set the height of the messaging area
    $('main#messaging').height(calculateMessagingAreaHeight());
    
    // next, calculate and set the available height for conversations
    var conversationHeight = calculateConversationHeight();
    $('section#chat-area div.conversation').each(function(index, conversation) {
        conversation.style.minHeight = conversationHeight;
        conversation.style.maxHeight = conversationHeight;
    });
    
    return;
}


/* Adds a message to a conversation with the given partner. It will be styled
 * as if it was sent by the current user.
 *
 * Returns the jQuerified version of the message div.
 */
function addSentMessage(partnerId, message) {
    // first, find and verify that the conversation exists
    var $conversation = findConversation(partnerId);
    
    if ($conversation === null) {
        console.log('Error: no conversation found for partnerId [' + partnerId + ']');
        return;
    }
    
    var $message = $('<p>', {
        class: 'message sent-message pending-message col-xs-10 col-xs-offset-2',
        text: message
    });
    
    // then append it to the conversation
    $conversation.append($message);
    
    return $message;
}


/* Adds a message to a conversation with the given partner. It will be styled
 * as if it was received by the partner. */
function addReceivedMessage(partnerId, message) {
    // first, find and verify that the conversation exists
    var $conversation = findConversation(partnerId);
    
    // if the conversation doesn't exist, create it
    if ($conversation === null) {
        $conversation = createConversation(partnerId);
        
        // and immediately hide it as it isn't the active conversation
        $conversation.hide();
    }
    
    // append the message
    $conversation.append($('<p>', {
        class: 'message received-message col-xs-10',
        text: message
    }));
    
    // update the conversation's last message field
    updateLastMessage(partnerId, message, true);
}


/* If the message area is not empty, send it as a message to the current chat
 * partner and updates the UI. */
function sendMessage() {
    var $messageTextInput = $('div#message-send-area input#message-text');
    var messageText = $messageTextInput.val();
    
    if (messageText !== '') {
        // send the message
        console.log('send: [' + messageText + ']');
        
        // clear the message area
        $messageTextInput.val('');
        
        // send the message through the socket
        socket.emit('send', {
            partnerId: window.currentPartnerId,
            text: messageText,
            messageId: nextMessageId
        });
        
        // add the sent message to the conversations
        var $message = addSentMessage(window.currentPartnerId, messageText);
        
        // update the conversation's last message field
        updateLastMessage(window.currentPartnerId, messageText, false);
        
        // keep track of the message in an array of unconfirmed messages
        unconfirmedMessages[nextMessageId] = $message;
        
        nextMessageId++;
    }
    
    return;
}


/* Updates the styling of the given unconfirmed message depending on whether
 * it was successfully sent or not.
 */
function updateUnconfirmedMessageStatus(messageId, wasSuccessful) {
    $message = unconfirmedMessages[messageId];
    
    if (!$message) {
        console.log('received update about an unknown unconfirmed message [' + messageId + ']');
        return;
    }
    
    // update the message in the conversation
    $message.removeClass('pending-mesage');
    $message.addClass(wasSuccessful ? 'successful-message' : 'failed-message');
    
    //remove it from the array of unconfirmed messages
    unconfirmedMessages[messageId] = null;
}


/* Creates a new row in the user list for a given user. */
function addUser(userId, name, lastMessage) {
    // generate HTML
    var $userRow = $('<div>', {
        class: 'user row',
        'data-user-id': userId
    });
    
    $userRow.append($('<p>', {
        class: 'user-name col-sm-4 col-md-3 col-lg-2',
        text: name
    }));
    
    $userRow.append($('<p>', {
        class: 'last-message text-muted col-sm-8 col-md-9 col-lg-10',
        text: lastMessage
    }));
    
    // add click event
    $userRow.click(onClickUser);
    
    // add to user list
    $userRow.appendTo($('section#user-list'));
    
    return;
}


/* Updates the last message text in the user side bar for the given partner. */
function updateLastMessage(userId, message, receivedMessage) {
    // trim the message so that is isn't too long
    if (message.length > 17)
    {
        message = message.substring(0, 17) + '...';
    }
    
    // find the user row in question
    var $userRow = $('section#user-list .user').filter(function(index, userRow) {
        return $(userRow).attr('data-user-id') == userId;
    });
    
    // then set the text
    $userRow.children('p.last-message').text(message);
    
    // mark the user row depending on whether or not this was a received message
    // for another conversation
    if (receivedMessage && userId != window.currentPartnerId) {
        $userRow.addClass('new-message-exists');
    }
    else {
        $userRow.removeClass('new-message-exists');
    }
}


/* Sets all onClick events required */
function setOnClickEvents() {
    // cick event for all user in the users list
    $('section#user-list div.user').each(function(index, user) {
        $(user).click(onClickUser);
    });
    
    // message sending events
    $('div#message-send-area button#message-send').click(sendMessage);
    $('div#message-send-area input#message-text').keypress(function(e) {
        // if the enter key is hit, send the message
        if (e.which === 13) {
            sendMessage();
        }
    });
}


/* Sets all listening requests for the socket. */
function setSocketEvents() {
    socket.on('notLoggedIn', function() {
        alert('Opps, you\'re not logged in!');
        window.location.href = '/';
    });
    
    socket.on('receive', function(data) {
        addReceivedMessage(data.senderId, data.text);
    });
    
    socket.on('failure', function(data) {
        alert(data.message);
    });
    
    // successful transmission of message
    socket.on('sent', function(data) {
        updateUnconfirmedMessageStatus(data.messageId, true);
    });
    
    socket.on('sendError', function(data) {
        updateUnconfirmedMessageStatus(data.messageId, false);
    });
}


window.onload = function() {
    // set the resizing of the messaging area and trigger it immediately
    $(window).resize(resizeMessagingArea);
    resizeMessagingArea();
    
    setOnClickEvents();
    
    setSocketEvents();
    
    // load the first chat area (which for the mockup is hiding all
    // chat areas except the first
    $(document.getElementsByClassName('user')[0]).click();
}