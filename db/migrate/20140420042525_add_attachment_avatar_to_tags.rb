class AddAttachmentAvatarToTags < ActiveRecord::Migration
  def self.up
    change_table :tags do |t|
      t.attachment :avatar
    end
  end

  def self.down
    drop_attached_file :tags, :avatar
  end
end
