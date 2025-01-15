const mongoose = require("mongoose");
const Event = require("../models/event");
const User = require("../models/user");
const wrapAsync = require("../utils/wrapAsync");
const logger = require("../utils/logger")("eventController");
const ExpressError = require("../utils/expressError");

// Index
module.exports.index = wrapAsync(async (req, res) => {
    logger.info("Fetching all events...");
    try {
      const events = await Event.find({})
        .populate("likes")
        .populate("joinMembers");
      logger.info(`Found ${events.length} events.`);
      res.render("events/index", { events, cssFile: "event/eventIndex.css" });
    } catch (err) {
      logger.error("Error fetching events:", err);
      throw new ExpressError(500, "Error fetching events.");
    }
});

// Show
module.exports.show = wrapAsync(async (req, res) => {
    const eventId = req.params.id;
    logger.info(`Fetching event with ID: ${eventId}`);
    try {
        const event = await Event.findById(eventId)
            .populate("likes")
            .populate("joinMembers");

        if (!event) {
            logger.error("Event not found.");
            throw new ExpressError(404, "Event not found.");
        }

        const isLiked = event.likes.includes(req.user ? req.user._id : null);
        res.render("events/show", { event, isLiked, cssFile: "event/eventShow.css" });
    } catch (err) {
        logger.error("Error fetching event:", err);
        throw new ExpressError(500, "Error fetching event.");
    }
});

// New
module.exports.new = (req, res) => {
    logger.info("Rendering new event form.");
    res.render("events/new", { cssFile: "event/eventNew.css" });
};

// Create
module.exports.create = wrapAsync(async (req, res) => {
  logger.info("Creating a new event...");
  try {
    console.log("create 1: req.body.event: ", req.body.event);

    const event = new Event(req.body.event);
    console.log("create 2");

    event.organiser = req.user._id;
    console.log("create 3");
    try {
      await event.save();
      console.log("Event saved successfully.");
    } catch (err) {
      console.log("create 3.5");
      logger.error(`Error saving event: ${err}`);

      console.log("create 3.6: ",err);
      req.flash("error", "Unable to save event.");
      throw new ExpressError(500, "Unable to save event.");
  }
  
    console.log("create 4");

    const organiser = await User.findById(req.user._id);
    console.log("create 5");
    if (!organiser.eventsOrganised.includes(event._id)) {
      console.log("create 6");
      organiser.eventsOrganised.push(event._id);
      console.log("create 7");
      await organiser.save();
      console.log(`Updated organiser ${organiser.username}: added event ${event.title}`);
    }

    logger.info(`New event created with ID: ${event._id}`);
    req.flash("success", "Event created successfully!");
    res.redirect(`/events/${event._id}`);
  } catch (err) {
    logger.error("Error creating event:", err);
    throw new ExpressError(500, "Unable to create event at the moment.");
  }
});

// Edit
module.exports.edit = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`Rendering edit form for event ID: ${eventId}`);
  try {
    const event = await Event.findById(eventId);
    if (!event) {
      logger.error("Event not found for editing.");
      throw new ExpressError(404, "Event not found.");
    }
    res.render("events/edit", { event, cssFile: "event/eventEdit.css" });
  } catch (err) {
    logger.error("Error rendering edit form:", err);
    throw new ExpressError(500, "Error rendering edit form.");
  }
});

// Update
module.exports.update = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`Updating event ID: ${eventId}`);
  try {
    console.log("update, req.body.event: ",req.body.event);
    
    const updatedEvent = await Event.findByIdAndUpdate(
      eventId,
      req.body.event,
      { new: true }
    );
    if (!updatedEvent) {
      throw new ExpressError(404, "Event not found.");
    }
    logger.info(`Event updated: ${updatedEvent.title}`);
    req.flash("success", "Event updated successfully!");
    res.redirect(`/events/${updatedEvent._id}`);
  } catch (err) {
    logger.error("Error updating event:", err);
    throw new ExpressError(500, "Unable to update event.");
  }
});

// Delete
module.exports.delete = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`Deleting event ID: ${eventId}`);
  try {
    await Event.findByIdAndDelete(eventId);
    req.flash("success", "Event deleted successfully!");
    res.redirect("/events");
  } catch (err) {
    logger.error("Error deleting event:", err);
    throw new ExpressError(500, "Unable to delete event.");
  }
});
// Join
module.exports.join = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`User joining event ID: ${eventId}`);
  try {
    const event = await Event.findById(eventId);
    if (!event) throw new ExpressError(404, "Event not found.");

    // Check if the user has already joined the event
    if (!event.joinMembers.includes(req.user._id)) {
      event.joinMembers.push(req.user._id);
      await event.save();
      req.flash("success", "You have joined the event!");
    } else {
      req.flash("info", "You are already a member of this event.");
    }
  // Store redirect URL
  res.locals.redirectUrl = req.get('referer'); // Redirect back to the previous page
  res.redirect(res.locals.redirectUrl);
  } catch (err) {
    logger.error("Error joining event:", err);
    throw new ExpressError(500, "Error joining event.");
  }
});

// Leave
module.exports.leave = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`User leaving event ID: ${eventId}`);
  try {
    const event = await Event.findById(eventId);
    if (!event) throw new ExpressError(404, "Event not found.");

    // Remove the user from the joined members
    event.joinMembers.pull(req.user._id);
    await event.save();

    req.flash("success", "You have left the event!");
  // Store redirect URL
  res.locals.redirectUrl = req.get('referer'); // Redirect back to the previous page
  res.redirect(res.locals.redirectUrl);
  } catch (err) {
    logger.error("Error leaving event:", err);
    throw new ExpressError(500, "Error leaving event.");
  }
});

// Like
module.exports.like = wrapAsync(async (req, res) => {
  const eventId = req.params.id;
  logger.info(`User toggling like for event ID: ${eventId}`);
  try {
    const event = await Event.findById(eventId);
    if (!event) throw new ExpressError(404, "Event not found.");

    const hasLiked = event.likes.includes(req.user._id);
    if (hasLiked) {
      event.likes.pull(req.user._id);
    } else {
      event.likes.push(req.user._id);
    }

    await event.save();
    req.flash("success", `You have ${hasLiked ? "unliked" : "liked"} the event.`);
  // Store redirect URL
  res.locals.redirectUrl = req.get('referer'); // Redirect back to the previous page
  res.redirect(res.locals.redirectUrl);
  } catch (err) {
    logger.error("Error liking event:", err);
    throw new ExpressError(500, "Failed to like event.");
  }
});

// Report
module.exports.report = wrapAsync(async (req, res) => {
    const eventId = req.params.id;
    logger.info(`User reporting event ID: ${eventId}`);
    try {
      const event = await Event.findById(eventId);
      if (!event) throw new ExpressError(404, "Event not found.");
      event.reports.push(req.user._id);
      await event.save();
      req.flash("success", "Event reported!");
      res.locals.redirectUrl = req.get('referer'); // Redirect back to the previous page
      res.redirect(res.locals.redirectUrl);
    } catch (err) {
      logger.error("Error reporting event:", err);
      throw new ExpressError(500, "Error reporting event.");
    }
});
