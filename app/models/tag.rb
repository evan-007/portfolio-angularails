class Tag < ActiveRecord::Base
	has_many :tech_tags
	has_many :projects, through: :tech_tags

  has_attached_file :avatar, styles: { :medium => "100x100>", :thumb => "50x50>" }, default_url: "/images/:style/missing.png"
  validates_attachment_content_type :avatar, content_type: /\Aimage\/.*\Z/
end
