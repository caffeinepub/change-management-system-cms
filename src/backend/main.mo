import Text "mo:core/Text";
import Order "mo:core/Order";
import Array "mo:core/Array";
import Iter "mo:core/Iter";
import Time "mo:core/Time";
import Map "mo:core/Map";
import Nat "mo:core/Nat";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Runtime "mo:core/Runtime";
import MixinStorage "blob-storage/Mixin";
import AccessControl "authorization/access-control";
import MixinAuthorization "authorization/MixinAuthorization";
import Storage "blob-storage/Storage";

actor {
  // Application-specific roles for Change Management System
  public type CMSRole = {
    #changeRequester;
    #changeReviewer;
    #dataCenterHelpdesk;
    #informationSecurity;
    #changeApprover;
    #implementationTeam;
  };

  public type UserProfile = {
    name : Text;
    email : Text;
    contactNumber : Text;
    department : Text;
    cmsRole : CMSRole;
  };

  public type ChangeRequestStatus = {
    #submitted;
    #underReview;
    #approved;
    #implStarted;
    #implDone;
    #closed;
    #rejected;
  };

  public type Priority = {
    #p1;
    #p2;
    #p3;
  };

  public type CRForm = {
    requesterName : Text;
    email : Text;
    contactNumber : Text;
    project : Text;
    description : Text;
    reason : Text;
    startDate : Time.Time;
    endDate : Time.Time;
    priority : Priority;
    impacted : Text;
    implementationPlan : Storage.ExternalBlob;
    rollbackPlan : Storage.ExternalBlob;
  };

  public type ChangeRequestId = Nat;

  public type ApprovalAction = {
    #approve;
    #reject;
    #sendBack;
  };

  public type ApprovalRecord = {
    approver : Principal;
    approverRole : CMSRole;
    action : ApprovalAction;
    comments : Text;
    timestamp : Time.Time;
  };

  public type ImplementationDetails = {
    actualStartTime : ?Time.Time;
    actualEndTime : ?Time.Time;
    success : ?Bool;
    remarks : Text;
    rcaDocument : ?Storage.ExternalBlob;
  };

  public type ChangeRequest = {
    crId : ChangeRequestId;
    requester : Principal;
    form : CRForm;
    status : ChangeRequestStatus;
    createdAt : Time.Time;
    lastUpdated : Time.Time;
    approvalHistory : [ApprovalRecord];
    assignedTeam : ?Principal;
    implementationDetails : ?ImplementationDetails;
  };

  module ChangeRequest {
    public func compareByTime(a : ChangeRequest, b : ChangeRequest) : Order.Order {
      Int.compare(a.createdAt, b.createdAt);
    };

    public func compareByCRId(a : ChangeRequest, b : ChangeRequest) : Order.Order {
      Nat.compare(a.crId, b.crId);
    };
  };

  let changeRequests = Map.empty<ChangeRequestId, ChangeRequest>();
  let userProfiles = Map.empty<Principal, UserProfile>();
  var nextCRId = 1;

  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);
  include MixinStorage();

  public type ChangeRequestPublicSummary = {
    crId : ChangeRequestId;
    requesterName : Text;
    project : Text;
    description : Text;
    reason : Text;
    startDate : Time.Time;
    endDate : Time.Time;
    priority : Priority;
    status : ChangeRequestStatus;
    createdAt : Time.Time;
    lastUpdated : Time.Time;
  };

  module ChangeRequestPublicSummary {
    public func compareByTime(a : ChangeRequestPublicSummary, b : ChangeRequestPublicSummary) : Order.Order {
      Int.compare(a.createdAt, b.createdAt);
    };
  };

  func generateCRId() : ChangeRequestId {
    let id = nextCRId;
    nextCRId += 1;
    id;
  };

  func getUserCMSRole(caller : Principal) : ?CMSRole {
    switch (userProfiles.get(caller)) {
      case (?profile) { ?profile.cmsRole };
      case (null) { null };
    };
  };

  func hasRequiredCMSRole(caller : Principal, requiredRole : CMSRole) : Bool {
    switch (getUserCMSRole(caller)) {
      case (?role) { role == requiredRole };
      case (null) { false };
    };
  };

  func canPerformWorkflowAction(caller : Principal, cr : ChangeRequest, action : ApprovalAction) : Bool {
    let roleOpt = getUserCMSRole(caller);
    switch (roleOpt) {
      case (null) { false };
      case (?role) {
        switch (cr.status, action, role) {
          // Reviewer can approve/reject/sendBack when status is submitted
          case (#submitted, _, #changeReviewer) { true };
          // Helpdesk can approve/sendBack when under review (assigns team)
          case (#underReview, #approve, #dataCenterHelpdesk) { true };
          case (#underReview, #sendBack, #dataCenterHelpdesk) { true };
          // InfoSec can approve/reject/sendBack after helpdesk
          case (#underReview, _, #informationSecurity) { 
            // Check if helpdesk has already approved
            let helpdeskApproved = cr.approvalHistory.find(
              func(record) { record.approverRole == #dataCenterHelpdesk and record.action == #approve }
            );
            helpdeskApproved != null
          };
          // Approver (CIO) can approve/reject when InfoSec approved
          case (#underReview, #approve, #changeApprover) {
            let infoSecApproved = cr.approvalHistory.find(
              func(record) { record.approverRole == #informationSecurity and record.action == #approve }
            );
            infoSecApproved != null
          };
          case (#underReview, #reject, #changeApprover) {
            let infoSecApproved = cr.approvalHistory.find(
              func(record) { record.approverRole == #informationSecurity and record.action == #approve }
            );
            infoSecApproved != null
          };
          case _ { false };
        };
      };
    };
  };

  // User Profile Management
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view profiles");
    };
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view profiles");
    };
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile unless admin");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can save profiles");
    };
    userProfiles.add(caller, profile);
  };

  // Change Request Creation - Only users with Change Requester role
  public shared ({ caller }) func createChangeRequest(form : CRForm) : async ChangeRequestId {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can submit Change Requests");
    };

    if (not hasRequiredCMSRole(caller, #changeRequester)) {
      Runtime.trap("Unauthorized: Only Change Requesters can submit Change Requests");
    };

    let crId = generateCRId();
    let time = Time.now();

    let changeRequest : ChangeRequest = {
      crId;
      requester = caller;
      form;
      status = #submitted;
      createdAt = time;
      lastUpdated = time;
      approvalHistory = [];
      assignedTeam = null;
      implementationDetails = null;
    };

    changeRequests.add(crId, changeRequest);
    crId;
  };

  func mapToChangeRequestPublicSummary(changeRequest : ChangeRequest) : ChangeRequestPublicSummary {
    {
      crId = changeRequest.crId;
      requesterName = changeRequest.form.requesterName;
      project = changeRequest.form.project;
      description = changeRequest.form.description;
      reason = changeRequest.form.reason;
      startDate = changeRequest.form.startDate;
      endDate = changeRequest.form.endDate;
      priority = changeRequest.form.priority;
      status = changeRequest.status;
      createdAt = changeRequest.createdAt;
      lastUpdated = changeRequest.lastUpdated;
    };
  };

  func filterAndMapChangeRequests(status : ?ChangeRequestStatus) : [ChangeRequestPublicSummary] {
    let changeRequestsIter = changeRequests.values().toArray().values();
    let filteredIter = changeRequestsIter.filter(
      func(cr) {
        switch (status) {
          case (null) { true };
          case (?s) { cr.status == s };
        };
      }
    );
    filteredIter.map(mapToChangeRequestPublicSummary).toArray().sort(ChangeRequestPublicSummary.compareByTime);
  };

  // Query functions - require authentication
  public query ({ caller }) func getAllPublicChangeRequests() : async [ChangeRequestPublicSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view Change Requests");
    };
    filterAndMapChangeRequests(null);
  };

  public query ({ caller }) func getChangeRequestById(crId : ChangeRequestId) : async ?ChangeRequest {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view Change Requests");
    };
    
    let crOpt = changeRequests.get(crId);
    switch (crOpt) {
      case (?cr) {
        // Users can view their own requests, admins can view all
        if (cr.requester == caller or AccessControl.isAdmin(accessControlState, caller)) {
          ?cr
        } else {
          // Other authenticated users can view summary but not full details
          // For now, allow all authenticated users to view (as per dashboard requirements)
          ?cr
        };
      };
      case (null) { null };
    };
  };

  public query ({ caller }) func getChangeRequestsByStatus(status : ChangeRequestStatus) : async [ChangeRequestPublicSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view Change Requests");
    };
    filterAndMapChangeRequests(?status);
  };

  public query ({ caller }) func getRecentChangeRequests(timestamp : Time.Time) : async [ChangeRequestPublicSummary] {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view Change Requests");
    };
    
    let changeRequestsIter = changeRequests.values().toArray().values();
    changeRequestsIter.filter(
      func(cr) { cr.createdAt >= timestamp }
    ).map(
      func(cr) { mapToChangeRequestPublicSummary(cr) }
    ).toArray().sort(ChangeRequestPublicSummary.compareByTime);
  };

  // Workflow Actions
  public shared ({ caller }) func processApproval(
    crId : ChangeRequestId,
    action : ApprovalAction,
    comments : Text
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can process approvals");
    };

    let crOpt = changeRequests.get(crId);
    switch (crOpt) {
      case (null) {
        Runtime.trap("Change Request not found");
      };
      case (?cr) {
        if (not canPerformWorkflowAction(caller, cr, action)) {
          Runtime.trap("Unauthorized: You cannot perform this action at this stage");
        };

        let roleOpt = getUserCMSRole(caller);
        let role = switch (roleOpt) {
          case (?r) { r };
          case (null) { Runtime.trap("User role not found") };
        };

        let approvalRecord : ApprovalRecord = {
          approver = caller;
          approverRole = role;
          action;
          comments;
          timestamp = Time.now();
        };

        let newHistory = cr.approvalHistory.concat([approvalRecord]);
        
        let newStatus = switch (action, role) {
          case (#approve, #changeReviewer) { #underReview };
          case (#approve, #changeApprover) { #approved };
          case (#reject, _) { #rejected };
          case (#sendBack, _) { #submitted };
          case _ { cr.status };
        };

        let updatedCR : ChangeRequest = {
          crId = cr.crId;
          requester = cr.requester;
          form = cr.form;
          status = newStatus;
          createdAt = cr.createdAt;
          lastUpdated = Time.now();
          approvalHistory = newHistory;
          assignedTeam = cr.assignedTeam;
          implementationDetails = cr.implementationDetails;
        };

        changeRequests.add(crId, updatedCR);
      };
    };
  };

  // Assign Implementation Team - Helpdesk only
  public shared ({ caller }) func assignImplementationTeam(
    crId : ChangeRequestId,
    teamMember : Principal
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can assign teams");
    };

    if (not hasRequiredCMSRole(caller, #dataCenterHelpdesk)) {
      Runtime.trap("Unauthorized: Only Data Center Helpdesk can assign implementation teams");
    };

    let crOpt = changeRequests.get(crId);
    switch (crOpt) {
      case (null) {
        Runtime.trap("Change Request not found");
      };
      case (?cr) {
        if (cr.status != #underReview and cr.status != #approved) {
          Runtime.trap("Cannot assign team at this stage");
        };

        let updatedCR : ChangeRequest = {
          crId = cr.crId;
          requester = cr.requester;
          form = cr.form;
          status = cr.status;
          createdAt = cr.createdAt;
          lastUpdated = Time.now();
          approvalHistory = cr.approvalHistory;
          assignedTeam = ?teamMember;
          implementationDetails = cr.implementationDetails;
        };

        changeRequests.add(crId, updatedCR);
      };
    };
  };

  // Update Implementation Details - Implementation Team only
  public shared ({ caller }) func updateImplementationDetails(
    crId : ChangeRequestId,
    details : ImplementationDetails
  ) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can update implementation");
    };

    if (not hasRequiredCMSRole(caller, #implementationTeam)) {
      Runtime.trap("Unauthorized: Only Implementation Team can update implementation details");
    };

    let crOpt = changeRequests.get(crId);
    switch (crOpt) {
      case (null) {
        Runtime.trap("Change Request not found");
      };
      case (?cr) {
        // Verify caller is assigned to this CR
        switch (cr.assignedTeam) {
          case (?team) {
            if (team != caller) {
              Runtime.trap("Unauthorized: You are not assigned to this Change Request");
            };
          };
          case (null) {
            Runtime.trap("No team assigned to this Change Request");
          };
        };

        if (cr.status != #approved and cr.status != #implStarted and cr.status != #implDone) {
          Runtime.trap("Cannot update implementation at this stage");
        };

        let newStatus = switch (details.actualEndTime, details.success) {
          case (?_, ?true) { #implDone };
          case (?_, ?false) { #implDone };
          case (?_, null) { #implStarted };
          case (null, _) { #implStarted };
        };

        let updatedCR : ChangeRequest = {
          crId = cr.crId;
          requester = cr.requester;
          form = cr.form;
          status = newStatus;
          createdAt = cr.createdAt;
          lastUpdated = Time.now();
          approvalHistory = cr.approvalHistory;
          assignedTeam = cr.assignedTeam;
          implementationDetails = ?details;
        };

        changeRequests.add(crId, updatedCR);
      };
    };
  };

  // Close Change Request - Implementation Team only
  public shared ({ caller }) func closeChangeRequest(crId : ChangeRequestId) : async () {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can close requests");
    };

    if (not hasRequiredCMSRole(caller, #implementationTeam)) {
      Runtime.trap("Unauthorized: Only Implementation Team can close Change Requests");
    };

    let crOpt = changeRequests.get(crId);
    switch (crOpt) {
      case (null) {
        Runtime.trap("Change Request not found");
      };
      case (?cr) {
        // Verify caller is assigned to this CR
        switch (cr.assignedTeam) {
          case (?team) {
            if (team != caller) {
              Runtime.trap("Unauthorized: You are not assigned to this Change Request");
            };
          };
          case (null) {
            Runtime.trap("No team assigned to this Change Request");
          };
        };

        if (cr.status != #implDone) {
          Runtime.trap("Can only close completed implementations");
        };

        let updatedCR : ChangeRequest = {
          crId = cr.crId;
          requester = cr.requester;
          form = cr.form;
          status = #closed;
          createdAt = cr.createdAt;
          lastUpdated = Time.now();
          approvalHistory = cr.approvalHistory;
          assignedTeam = cr.assignedTeam;
          implementationDetails = cr.implementationDetails;
        };

        changeRequests.add(crId, updatedCR);
      };
    };
  };

  // Admin function to get all user profiles
  public query ({ caller }) func getAllUserProfiles() : async [(Principal, UserProfile)] {
    if (not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Only admins can view all user profiles");
    };
    userProfiles.entries().toArray();
  };

  // Statistics for dashboards - authenticated users only
  public query ({ caller }) func getChangeRequestStats() : async {
    total : Nat;
    byPriority : { p1 : Nat; p2 : Nat; p3 : Nat };
    byStatus : {
      submitted : Nat;
      underReview : Nat;
      approved : Nat;
      implStarted : Nat;
      implDone : Nat;
      closed : Nat;
      rejected : Nat;
    };
    successRate : { successful : Nat; failed : Nat };
  } {
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only authenticated users can view statistics");
    };

    var p1Count = 0;
    var p2Count = 0;
    var p3Count = 0;
    var submittedCount = 0;
    var underReviewCount = 0;
    var approvedCount = 0;
    var implStartedCount = 0;
    var implDoneCount = 0;
    var closedCount = 0;
    var rejectedCount = 0;
    var successfulCount = 0;
    var failedCount = 0;

    for (cr in changeRequests.values()) {
      switch (cr.form.priority) {
        case (#p1) { p1Count += 1 };
        case (#p2) { p2Count += 1 };
        case (#p3) { p3Count += 1 };
      };

      switch (cr.status) {
        case (#submitted) { submittedCount += 1 };
        case (#underReview) { underReviewCount += 1 };
        case (#approved) { approvedCount += 1 };
        case (#implStarted) { implStartedCount += 1 };
        case (#implDone) { implDoneCount += 1 };
        case (#closed) { closedCount += 1 };
        case (#rejected) { rejectedCount += 1 };
      };

      switch (cr.implementationDetails) {
        case (?details) {
          switch (details.success) {
            case (?true) { successfulCount += 1 };
            case (?false) { failedCount += 1 };
            case (null) {};
          };
        };
        case (null) {};
      };
    };

    {
      total = changeRequests.size();
      byPriority = { p1 = p1Count; p2 = p2Count; p3 = p3Count };
      byStatus = {
        submitted = submittedCount;
        underReview = underReviewCount;
        approved = approvedCount;
        implStarted = implStartedCount;
        implDone = implDoneCount;
        closed = closedCount;
        rejected = rejectedCount;
      };
      successRate = { successful = successfulCount; failed = failedCount };
    };
  };
};
